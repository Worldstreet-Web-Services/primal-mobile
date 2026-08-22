/**
 * The one HTTP client for the Primal gateway. Everything else in
 * `src/lib/gateway/` and every feature module that talks to api.tsion.io goes
 * through `request()` here — there is no second fetch anywhere.
 *
 * What it owns, and why each part has to live at this layer:
 *
 * - **Bearer injection and refresh.** Refresh tokens ROTATE, so two concurrent
 *   refreshes would race and one would consume the token the other needs. The
 *   single-flight promise below is the only thing standing between a cold start
 *   that fires five requests and a permanently signed-out user.
 * - **Retries.** A GET may be replayed freely. A mutation may be replayed ONLY
 *   with the idempotency key it was first sent with — a timeout is not a
 *   failure, and minting a second key after one is how a user gets charged
 *   twice. 4xx is never retried generically; 429 is backed off, never stormed.
 * - **Error shape.** Every failure leaves here as `ApiError`,
 *   `SessionExpiredError`, `NetworkError` or `AbortedError`. Call sites branch
 *   on those, never on a status code they parsed themselves.
 *
 * Logging discipline: this file never logs a token, a request body, a response
 * body, or a signature. The dev breadcrumb carries method, path, status and
 * correlation id — enough to find the request in the gateway's own logs, and
 * nothing that would be a leak if it reached a crash reporter.
 */

import * as Crypto from "expo-crypto";

import * as placeholder from "./placeholder";
import * as session from "./session";
import { isExpired } from "./time";
import {
  AbortedError,
  ApiError,
  NetworkError,
  SessionExpiredError,
  type RateLimitInfo,
  type SessionResponse,
} from "./types";

/* ------------------------------------------------------------------ config */

const DEFAULT_BASE_URL = "https://api.tsion.io";

export const GATEWAY_BASE_URL = (
  process.env.EXPO_PUBLIC_PRIMAL_API_URL ?? DEFAULT_BASE_URL
).replace(/\/+$/, "");

/** Reads get longer than the eye can wait for; the gateway's own upstream
 *  timeout sits around 5s, so 20s covers a slow mobile leg without hanging. */
const DEFAULT_TIMEOUT_MS = 20_000;
/** Mutations are given more room: a double-charge is worse than a spinner. */
const DEFAULT_MUTATION_TIMEOUT_MS = 30_000;

/** Attempts, not retries — 3 means at most two replays. */
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 300;
const MAX_BACKOFF_MS = 4_000;
/** Past this, waiting is worse than telling the user. Applies to 429 too. */
const MAX_RETRY_DELAY_MS = 5_000;

/** Statuses worth trying again. 500 is absent on purpose: it usually means a
 *  deterministic server fault, and replaying it just doubles the load. */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: HttpMethod;
  /** Path only, e.g. `/v1/linkpay/balance`. */
  path: string;
  query?: Record<string, QueryValue>;
  /** Serialized as JSON. Include `idempotencyKey` to make a POST replayable. */
  body?: unknown;
  /** Attach the bearer. Default `true`. */
  auth?: boolean;
  timeoutMs?: number;
  /** Caller's own cancellation (screen unmounted, search superseded). */
  signal?: AbortSignal;
  /** Force replay off, e.g. for a GET whose result you never want twice. */
  retry?: boolean;
  maxAttempts?: number;
  /** Reuse an id to tie several calls into one traced operation. */
  correlationId?: string;
}

interface NormalizedRequest {
  method: HttpMethod;
  path: string;
  url: string;
  bodyText: string | null;
  timeoutMs: number;
  signal: AbortSignal | undefined;
  replayable: boolean;
  maxAttempts: number;
  correlationId: string;
}

/* ------------------------------------------------------------------- utils */

function correlationId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // expo-crypto is a native module; a preview build without it must not take
    // the whole client down over a telemetry header.
    return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = `${GATEWAY_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return base;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `${base}?${parts.join("&")}` : base;
}

/**
 * A mutation is replayable only when it carries a stable idempotency key — the
 * gateway then collapses the duplicate instead of performing it twice. Without
 * one, a POST that timed out might have succeeded, and the only safe move is to
 * surface it and let the caller decide.
 */
function carriesIdempotencyKey(body: unknown): boolean {
  const key = (body as { idempotencyKey?: unknown } | null)?.idempotencyKey;
  return typeof key === "string" && key.length >= 8;
}

/** Full jitter: the whole window is random, so a fleet of clients coming back
 *  from an outage spreads out instead of re-synchronising on the same tick. */
function backoffDelay(attempt: number): number {
  const cap = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  return Math.random() * cap;
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = new Date(header).getTime();
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}

function readRateLimit(headers: Headers): RateLimitInfo {
  const num = (name: string) => {
    const raw = headers.get(name);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  return { limit: num("x-ratelimit-limit"), remaining: num("x-ratelimit-remaining") };
}

function normalizeMessage(body: unknown, fallback: string): string {
  const raw = (body as { message?: unknown } | null)?.message;
  if (typeof raw === "string" && raw.trim() !== "") return raw;
  if (Array.isArray(raw)) {
    const joined = raw.filter((m) => typeof m === "string").join(", ");
    if (joined !== "") return joined;
  }
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === "string" && error.trim() !== "") return error;
  return fallback;
}

/** The gateway's envelope has no `code` today; read the usual field names in
 *  case one appears, rather than teaching every call site to sniff strings. */
function readCode(body: unknown): string | null {
  const o = body as Record<string, unknown> | null;
  for (const field of ["code", "errorCode", "error_code"] as const) {
    const value = o?.[field];
    if (typeof value === "string" && value !== "") return value;
  }
  return null;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function trace(message: string, detail: Record<string, unknown>): void {
  // Deliberately never carries headers, bodies or tokens.
  if (__DEV__) console.log(`[gateway] ${message}`, detail);
}

/* ------------------------------------------------------------- one attempt */

async function attempt<T>(req: NormalizedRequest, token: string | null): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, req.timeoutMs);

  // Composed by hand: AbortSignal.any is not available on every RN runtime.
  const onExternalAbort = () => controller.abort();
  if (req.signal) {
    if (req.signal.aborted) {
      clearTimeout(timer);
      throw new AbortedError();
    }
    req.signal.addEventListener("abort", onExternalAbort);
  }

  const headers: Record<string, string> = {
    accept: "application/json",
    "x-correlation-id": req.correlationId,
  };
  if (req.bodyText !== null) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    // The one place the app talks to the gateway — and therefore the one place
    // a stand-in can replace it without any caller knowing. Everything either
    // side of this line (bearer, refresh, retries, error mapping, tracing) runs
    // identically against the placeholder, which is what makes a credential-less
    // build exercise the real flow rather than a simplified one. `__DEV__` only;
    // see `placeholderAuth` in src/lib/devMode.ts.
    response = placeholder.usingPlaceholderGateway
      ? await placeholder.respond({
          method: req.method,
          path: req.path,
          bodyText: req.bodyText,
          token,
          correlationId: req.correlationId,
          signal: controller.signal,
        })
      : await fetch(req.url, {
          method: req.method,
          headers,
          body: req.bodyText ?? undefined,
          signal: controller.signal,
        });
  } catch (error) {
    if (req.signal?.aborted) throw new AbortedError();
    throw new NetworkError({
      message: timedOut
        ? `Timed out after ${req.timeoutMs}ms.`
        : "Could not reach Primal. Check your connection.",
      correlationId: req.correlationId,
      timedOut,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener("abort", onExternalAbort);
  }

  // The gateway echoes our id back and mints one if we send none — observed
  // live, so prefer the response's copy as the value support should quote.
  const cid = response.headers.get("x-correlation-id") ?? req.correlationId;

  let parsed: unknown = null;
  if (response.status !== 204 && response.headers.get("content-length") !== "0") {
    const text = await response.text().catch(() => "");
    if (text !== "") {
      try {
        parsed = JSON.parse(text);
      } catch {
        // Non-JSON: nginx HTML on a bad gateway, or a proxy interstitial.
        parsed = null;
      }
    }
  }

  trace("response", {
    method: req.method,
    path: req.path,
    status: response.status,
    correlationId: cid,
    // The server's OWN words, dev only, on failures only.
    //
    // Surfaces deliberately do not show these: `describeGatewayFailure`
    // replaces every 5xx with "Primal is temporarily unavailable" because the
    // real text is written for operators ("User Management service is
    // unavailable" is a genuine body from this gateway). That is right for
    // members and useless for whoever has to fix it — the one line that says
    // WHICH service failed was being thrown away. It goes to the dev console
    // and nowhere else, and carries no headers, no body and no token.
    ...(response.ok
      ? null
      : { serverMessage: normalizeMessage(parsed, "(no message in body)") }),
  });

  if (!response.ok) {
    throw new ApiError({
      statusCode: response.status,
      message: normalizeMessage(parsed, `Request failed (${response.status}).`),
      correlationId:
        typeof (parsed as { correlationId?: unknown })?.correlationId === "string"
          ? ((parsed as { correlationId: string }).correlationId)
          : cid,
      code: readCode(parsed),
      retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      rateLimit: readRateLimit(response.headers),
    });
  }

  return parsed as T;
}

/* ----------------------------------------------------------- attempt loop */

async function dispatch<T>(req: NormalizedRequest, token: string | null): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < req.maxAttempts; index += 1) {
    try {
      return await attempt<T>(req, token);
    } catch (error) {
      lastError = error;

      // The caller cancelled, or the session is done — neither improves by
      // being tried again.
      if (AbortedError.is(error) || SessionExpiredError.is(error)) throw error;

      const isLast = index === req.maxAttempts - 1;
      if (isLast || !req.replayable) throw error;

      let delay: number;
      if (NetworkError.is(error)) {
        delay = backoffDelay(index);
      } else if (ApiError.is(error) && error.statusCode === 429) {
        // Respect the server's own number when it gives one; otherwise back off
        // harder than usual, since 429 means we are already asking too often.
        delay = error.retryAfterMs ?? backoffDelay(index) * 2;
      } else if (ApiError.is(error) && RETRYABLE_STATUSES.has(error.statusCode)) {
        delay = backoffDelay(index);
      } else {
        // 4xx (other than 429), 500, anything unrecognised: not our call to
        // repeat. A 409 idempotency conflict in particular means the gateway
        // already has this operation under a different shape.
        throw error;
      }

      if (delay > MAX_RETRY_DELAY_MS) throw error;

      trace("retry", {
        method: req.method,
        path: req.path,
        attempt: index + 1,
        inMs: Math.round(delay),
        correlationId: req.correlationId,
      });
      await sleep(delay);
    }
  }

  throw lastError;
}

/* ---------------------------------------------------------------- refresh */

/**
 * The single in-flight refresh. Every 401 in the app funnels through this
 * promise, so N concurrent 401s produce exactly ONE call to
 * `/v1/auth/refresh` and share its result.
 */
let refreshInFlight: Promise<string> | null = null;

/**
 * Rotate the token pair. Resolves to the new access token.
 *
 * Never retried, at any layer. The refresh token is consumed by a successful
 * call, so a replay after a timeout would either be rejected (having already
 * rotated) or race the write of the pair it produced. One attempt, and a
 * network failure is reported as one — the tokens stay on disk so an offline
 * user is not signed out for being in a lift.
 */
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh();
    // Detach the bookkeeping from the caller's chain so a rejection handled by
    // the caller does not also surface as unhandled here.
    void refreshInFlight.catch(() => undefined).then(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function performRefresh(): Promise<string> {
  const stored = await session.load();

  if (!stored) {
    throw new SessionExpiredError("No Primal session on this device.");
  }
  if (isExpired(stored.refreshTokenExpiresAt)) {
    await session.clear();
    throw new SessionExpiredError("Primal refresh token has expired.");
  }

  let next: SessionResponse;
  try {
    next = await attempt<SessionResponse>(
      {
        method: "POST",
        path: "/v1/auth/refresh",
        url: buildUrl("/v1/auth/refresh"),
        bodyText: JSON.stringify({ refreshToken: stored.refreshToken }),
        timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
        signal: undefined,
        replayable: false,
        maxAttempts: 1,
        correlationId: correlationId(),
      },
      null,
    );
  } catch (error) {
    // A rejected token is unrecoverable and the session must go. A network
    // failure is not the token's fault — keep it and let the next call retry.
    //
    // 429 and 408 sit inside the 4xx range but are NOT verdicts on the token:
    // the gateway rate-limits per IP, so a member behind carrier NAT or a shared
    // office address can trip it through no fault of their own, and a timeout
    // says nothing at all. Wiping the keychain on either silently signs a paying
    // member out with no way back but a fresh SIWE signature — the exact
    // auth/entitlement collapse the contract forbids. They fall through to the
    // rethrow below, which keeps both tokens for the next attempt.
    const dead =
      ApiError.is(error) &&
      error.statusCode >= 400 &&
      error.statusCode < 500 &&
      error.statusCode !== 429 &&
      error.statusCode !== 408;
    if (dead) {
      await session.clear();
      throw new SessionExpiredError("Primal session could not be renewed.", error);
    }
    throw error;
  }

  if (!next?.accessToken || !next?.refreshToken) {
    await session.clear();
    throw new SessionExpiredError("Refresh returned an incomplete token pair.");
  }

  await session.save(next);
  return next.accessToken;
}

/* ----------------------------------------------------------- public entry */

/**
 * Perform a gateway request.
 *
 * Throws `ApiError` (gateway said no), `SessionExpiredError` (sign in again),
 * `NetworkError` (never got an answer) or `AbortedError` (you cancelled it).
 * Resolves to the parsed JSON body, or `undefined` for an empty 2xx.
 */
export async function request<T>(options: RequestOptions): Promise<T> {
  const method = options.method ?? "GET";
  const isRead = method === "GET";
  const useAuth = options.auth !== false;
  const bodyText = options.body === undefined ? null : JSON.stringify(options.body);

  const req: NormalizedRequest = {
    method,
    path: options.path,
    url: buildUrl(options.path, options.query),
    bodyText,
    timeoutMs:
      options.timeoutMs ?? (isRead ? DEFAULT_TIMEOUT_MS : DEFAULT_MUTATION_TIMEOUT_MS),
    signal: options.signal,
    replayable:
      options.retry ?? (isRead || carriesIdempotencyKey(options.body)),
    maxAttempts: Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS),
    correlationId: options.correlationId ?? correlationId(),
  };

  if (!useAuth) return dispatch<T>(req, null);

  let token = await session.getAccessToken();
  if (!token) {
    // No access token but possibly a refresh token — try to rotate into one
    // rather than firing a request we know will 401.
    token = await refreshSession();
  }

  try {
    return await dispatch<T>(req, token);
  } catch (error) {
    if (!ApiError.is(error) || error.statusCode !== 401) throw error;

    // Another request may already have refreshed while this one was in flight.
    // Reuse that result instead of rotating a second time.
    const current = await session.getAccessToken();
    const fresh = current && current !== token ? current : await refreshSession();

    try {
      return await dispatch<T>(req, fresh);
    } catch (retryError) {
      if (ApiError.is(retryError) && retryError.statusCode === 401) {
        // A freshly minted token was still refused. Nothing local can fix that.
        await session.clear();
        throw new SessionExpiredError(
          "Primal rejected a freshly refreshed session.",
          retryError,
        );
      }
      throw retryError;
    }
  }
}

/* ------------------------------------------------------------ conveniences */

export const get = <T>(path: string, options: Omit<RequestOptions, "path" | "method" | "body"> = {}) =>
  request<T>({ ...options, path, method: "GET" });

export const post = <T>(
  path: string,
  body?: unknown,
  options: Omit<RequestOptions, "path" | "method" | "body"> = {},
) => request<T>({ ...options, path, method: "POST", body });

/**
 * A stable idempotency key for a NEW operation.
 *
 * Mint one per intended operation, persist it beside whatever you are about to
 * do, and reuse it for every retry of that same operation with the same
 * parameters. Never call this in a retry path: a timeout is not a failure, and
 * a second key turns one subscription into two.
 */
export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${correlationId()}`;
}
