/**
 * A stand-in Primal gateway, served from the device.
 *
 * `client.ts` puts every gateway request on the wire through exactly one
 * `fetch`. When `placeholderAuth` is on, that one call comes here instead and
 * this file answers it — same URLs, same status codes, same error envelope
 * (`{statusCode, message, correlationId}`), same JSON shapes. Nothing upstream
 * knows the difference: bearer injection, the single-flight refresh, the retry
 * policy, `ApiError` / `SessionExpiredError`, `probeEntitlement`, the checkout
 * intent and its idempotency key all run exactly as they do against
 * api.tsion.io.
 *
 * That is the whole point of answering HERE rather than short-circuiting the
 * screens. A paywall that is skipped is a paywall that is never tested. This
 * way the app performs the real sequence — SIWE handshake, entitlement probe,
 * subscription create, payment poll, entitlement re-probe — and the only thing
 * that has been replaced is the server on the other end.
 *
 * WHAT IT DELIBERATELY IS NOT:
 *
 * - **Not a way in.** Entitlement is still refused until the placeholder
 *   payment settles, because the value of walking the flow is walking all of
 *   it. There is a separate flag for skipping the paywall (`skipPaywall`) and
 *   this is not it.
 * - **Not money.** The deposit address is the zero address. It can receive
 *   nothing, it is recognisable as a non-address to anyone who has seen one,
 *   and that is the only responsible thing for a fake checkout to display.
 * - **Not a mock of the whole gateway.** It answers the routes the sign-in →
 *   PIN → biometrics → payment → welcome sequence actually uses. Everything
 *   else returns 501 and says so in the log, so an unimplemented route reads as
 *   an unimplemented route rather than as a bug in the screen that called it.
 *
 * `__DEV__`-only, via `placeholderAuth`. A release build never reaches this.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { announcePlaceholderAuth, placeholderAuth } from "../devMode";

export const usingPlaceholderGateway = placeholderAuth;

/* ------------------------------------------------------------------ shape */

export interface PlaceholderRequest {
  method: string;
  /** Path only, e.g. `/v1/subscriptions/sub_1/payment`. */
  path: string;
  bodyText: string | null;
  /** The bearer `client.ts` would have sent, or null. */
  token: string | null;
  correlationId: string;
  /** The composed timeout/caller signal. Honoured so a screen that unmounts
   *  mid-request still gets an `AbortedError`, exactly as it would on the wire. */
  signal?: AbortSignal;
}

/* ------------------------------------------------------------------ timing */

/** How long the stand-in takes to "notice" a transfer, and then to settle it. */
const SETTLE_MS = readMillis(process.env.EXPO_PUBLIC_DEV_PLACEHOLDER_SETTLE_MS, 12_000);
const PROCESSING_MS = Math.round(SETTLE_MS / 2);

/** One membership period. Long enough that no dev run watches it lapse. */
const PERIOD_MS = 30 * 24 * 60 * 60_000;

const ACCESS_TOKEN_MS = 60 * 60_000;
const REFRESH_TOKEN_MS = PERIOD_MS;
const CHALLENGE_MS = 5 * 60_000;

/**
 * A little latency, so the screens' own loading states are exercised.
 * Instant answers are the one way a stand-in can be less useful than the real
 * thing: every spinner, skeleton and disabled button goes untested.
 */
const LATENCY_MS = 220;

function readMillis(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/* ------------------------------------------------------------------- money */

/**
 * Mirrors `MEMBERSHIP_PRICE` / `MEMBERSHIP_SETTLEMENT` in `subscription.ts`,
 * and must stay in step with them.
 *
 * Copied rather than imported on purpose: `subscription.ts` imports `client.ts`,
 * `client.ts` imports this, and closing that circle would make the module load
 * order decide whether the price exists. Two constants that must agree are
 * worth less than a client that cannot be initialised.
 */
const PRICE_MINOR = "100000"; // USD 1,000.00, 2dp
const PRICE_CURRENCY = "USD";
const SETTLEMENT_MINOR = "1000000000"; // 1,000 USDC, 6dp

/** Grossed up ~0.5% the way a provider quote is — see `originAmount`. */
const ORIGIN_MINOR = "1005000000";

/**
 * Where the placeholder tells you to send $1,000: nowhere.
 *
 * A real `depositAddress` is a one-time address minted per payment, and money
 * sent to a stale one is gone. A stand-in that minted realistic-looking
 * addresses would be inviting exactly that mistake for no benefit — the zero
 * address is unmistakable, and it is the one string here that a person might
 * otherwise act on.
 */
const DEPOSIT_ADDRESS = "0x0000000000000000000000000000000000000000";

/* ------------------------------------------------------------------- state */

interface Checkout {
  idempotencyKey: string;
  subscriptionId: string;
  paymentId: string;
  originChainId: number;
  originAsset: string;
  refundTo: string;
  /** When the deposit address was issued — the clock the payment settles on. */
  createdAt: number;
}

interface State {
  /** The wallet this account belongs to. A different one resets everything. */
  walletAddress: string | null;
  userId: string | null;
  sessionId: string | null;
  refreshToken: string | null;
  checkout: Checkout | null;
  /** When membership began. `null` means it never has. */
  activeSince: number | null;
  cancelAtPeriodEnd: boolean;
  /** Ended outright rather than at the period end. Terminal. */
  canceled: boolean;
}

const EMPTY: State = {
  walletAddress: null,
  userId: null,
  sessionId: null,
  refreshToken: null,
  checkout: null,
  activeSince: null,
  cancelAtPeriodEnd: false,
  canceled: false,
};

const KEY = "paradigm.gateway.placeholder_state";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.gateway",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const isWeb = Platform.OS === "web";

let state: State | null = null;

async function load(): Promise<State> {
  if (state) return state;
  if (isWeb) {
    state = { ...EMPTY };
    return state;
  }
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    state = raw ? { ...EMPTY, ...(JSON.parse(raw) as State) } : { ...EMPTY };
  } catch {
    state = { ...EMPTY };
  }
  return state;
}

async function save(next: State): Promise<void> {
  state = next;
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next), OPTIONS);
  } catch {
    // Only costs the ability to restore this account on the next launch.
  }
}

/* ------------------------------------------------------------------- utils */

function id(prefix: string): string {
  try {
    return `${prefix}_${Crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

const iso = (at: number): string => new Date(at).toISOString();

/**
 * A response `client.ts` can read.
 *
 * Duck-typed rather than `new Response(...)`: the constructor comes from React
 * Native's fetch polyfill, and depending on a polyfill's presence to serve a
 * response that never travels anywhere is a needless way for this to break on
 * some runtime. `attempt()` reads exactly four things, and they are all here.
 */
function reply(status: number, body: unknown, correlationId: string): Response {
  const text = body === undefined ? "" : JSON.stringify(body);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "content-length": String(text.length),
    "x-correlation-id": correlationId,
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

/** The gateway's own error envelope, as observed live on 400/401/403/404/503. */
function fail(status: number, message: string, correlationId: string): Response {
  return reply(status, { statusCode: status, message, correlationId }, correlationId);
}

function parse(bodyText: string | null): Record<string, unknown> {
  if (!bodyText) return {};
  try {
    const value: unknown = JSON.parse(bodyText);
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

/* -------------------------------------------------------------- membership */

/** Entitled means paid AND inside the period. Nothing else grants it. */
function entitled(s: State): boolean {
  if (s.canceled || s.activeSince === null) return false;
  return Date.now() < s.activeSince + PERIOD_MS;
}

type PaymentStatusWire = "AWAITING_TRANSFER" | "PROCESSING" | "SETTLED";

/**
 * The payment advances on a clock rather than on a transfer, because there is
 * no chain here to watch. `AWAITING_TRANSFER` → `PROCESSING` → `SETTLED` over
 * `SETTLE_MS`, which is long enough for the checkout screen to poll twice and
 * show each state it was built to show.
 */
function paymentStatus(s: State): PaymentStatusWire | null {
  if (!s.checkout) return null;
  if (s.activeSince !== null) return "SETTLED";
  const elapsed = Date.now() - s.checkout.createdAt;
  if (elapsed >= SETTLE_MS) return "SETTLED";
  return elapsed >= PROCESSING_MS ? "PROCESSING" : "AWAITING_TRANSFER";
}

/**
 * Settling the payment is what grants membership — and it is granted HERE, in
 * the stand-in for the server, never by the app. The client's rule that only
 * the backend decides entitlement holds unchanged; this file simply is the
 * backend for the duration of a dev run.
 */
async function settleIfDue(s: State): Promise<State> {
  if (s.activeSince !== null || paymentStatus(s) !== "SETTLED") return s;
  const next = { ...s, activeSince: Date.now() };
  await save(next);
  return next;
}

function subscriptionBody(s: State): Record<string, unknown> {
  const start = s.activeSince ?? s.checkout?.createdAt ?? Date.now();
  const status = s.canceled
    ? "CANCELED"
    : s.activeSince === null
      ? "PENDING_PAYMENT"
      : !entitled(s)
        ? "EXPIRED"
        : s.cancelAtPeriodEnd
          ? "CANCEL_AT_PERIOD_END"
          : "ACTIVE";

  return {
    id: s.checkout?.subscriptionId ?? id("sub"),
    status,
    price: { amountMinor: PRICE_MINOR, currency: PRICE_CURRENCY },
    currentPeriodStart: iso(start),
    currentPeriodEnd: iso(start + PERIOD_MS),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    createdAt: iso(s.checkout?.createdAt ?? start),
    updatedAt: iso(Date.now()),
  };
}

function paymentBody(s: State): Record<string, unknown> | null {
  if (!s.checkout) return null;
  return {
    id: s.checkout.paymentId,
    subscriptionId: s.checkout.subscriptionId,
    status: paymentStatus(s),
    depositAddress: DEPOSIT_ADDRESS,
    originChainId: s.checkout.originChainId,
    originAsset: s.checkout.originAsset,
    originAmount: ORIGIN_MINOR,
    requiredSettlementAmount: SETTLEMENT_MINOR,
    amountMinor: PRICE_MINOR,
    currency: PRICE_CURRENCY,
    refundTo: s.checkout.refundTo,
    expiresAt: iso(s.checkout.createdAt + 30 * 60_000),
    createdAt: iso(s.checkout.createdAt),
  };
}

/* ------------------------------------------------------------------ routes */

async function auth(req: PlaceholderRequest, s: State): Promise<Response | null> {
  const cid = req.correlationId;
  const body = parse(req.bodyText);

  if (req.method === "POST" && req.path === "/v1/auth/challenge") {
    const walletAddress = str(body.walletAddress);
    if (!walletAddress) return fail(400, "walletAddress is required.", cid);

    const nonce = id("nonce").slice(6);
    // SIWE-shaped, with the address on its own line: `verify` below reads it
    // back out, which is the stand-in's equivalent of recovering a signature.
    const message = [
      "placeholder.primal.local wants you to sign in with your Ethereum account:",
      walletAddress,
      "",
      "PLACEHOLDER SESSION. This build is signed in against a stand-in gateway",
      "running on the device. No real account, no real money.",
      "",
      "URI: https://placeholder.primal.local",
      "Version: 1",
      "Chain ID: 8453",
      `Nonce: ${nonce}`,
      `Issued At: ${iso(Date.now())}`,
    ].join("\n");

    return reply(
      201,
      { message, nonce, expiresAt: iso(Date.now() + CHALLENGE_MS) },
      cid,
    );
  }

  if (req.method === "POST" && req.path === "/v1/auth/verify") {
    const message = str(body.message);
    const signature = str(body.signature);
    if (!message || !signature) return fail(400, "Bad Request Exception", cid);
    // Shape only. There is no key to recover to — but a malformed signature is
    // still a 400 here, so the client's stale-challenge retry has something
    // real to be exercised against.
    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
      return fail(400, "Bad Request Exception", cid);
    }

    const walletAddress = /^0x[0-9a-fA-F]{40}$/m.exec(message)?.[0];
    if (!walletAddress) return fail(400, "Bad Request Exception", cid);

    // A different wallet is a different account. Membership belongs to the
    // wallet that paid for it, so it does not follow a new one in.
    const sameWallet =
      s.walletAddress !== null &&
      s.walletAddress.toLowerCase() === walletAddress.toLowerCase();
    const base = sameWallet ? s : { ...EMPTY };

    const accessToken = id("pat");
    const refreshToken = id("prt");
    const next: State = {
      ...base,
      walletAddress,
      userId: base.userId ?? id("usr"),
      sessionId: id("ses"),
      refreshToken,
    };
    await save(next);

    return reply(
      201,
      {
        accessToken,
        refreshToken,
        accessTokenExpiresAt: iso(Date.now() + ACCESS_TOKEN_MS),
        refreshTokenExpiresAt: iso(Date.now() + REFRESH_TOKEN_MS),
        user: { id: next.userId, walletAddress },
      },
      cid,
    );
  }

  if (req.method === "POST" && req.path === "/v1/auth/refresh") {
    const presented = str(body.refreshToken);
    if (!presented || presented !== s.refreshToken) {
      // A rejected refresh token is unrecoverable, and the client turns this
      // into the `SessionExpiredError` that routes back to sign-in.
      return fail(401, "Refresh token is not valid.", cid);
    }
    const refreshToken = id("prt");
    await save({ ...s, refreshToken });
    return reply(
      200,
      {
        accessToken: id("pat"),
        refreshToken,
        accessTokenExpiresAt: iso(Date.now() + ACCESS_TOKEN_MS),
        refreshTokenExpiresAt: iso(Date.now() + REFRESH_TOKEN_MS),
        user: { id: s.userId, walletAddress: s.walletAddress },
      },
      cid,
    );
  }

  if (req.method === "GET" && req.path === "/v1/auth/me") {
    if (!req.token || !s.userId || !s.walletAddress) {
      return fail(401, "Unauthorized", cid);
    }
    return reply(
      200,
      { userId: s.userId, walletAddress: s.walletAddress, sessionId: s.sessionId },
      cid,
    );
  }

  if (req.method === "POST" && req.path === "/v1/auth/logout") {
    // The membership survives; the session does not. Signing out is not
    // cancelling, and the wallet that paid still owns what it paid for.
    await save({ ...s, refreshToken: null, sessionId: null });
    return reply(200, { revoked: true }, cid);
  }

  return null;
}

async function membership(req: PlaceholderRequest, s: State): Promise<Response | null> {
  const cid = req.correlationId;
  const body = parse(req.bodyText);

  /* The entitlement probe. `probeEntitlement` reads a 403 as "not entitled" and
     a 404 as "entitled, no LinkPay account provisioned" — and 404 is the honest
     answer here, because a stand-in has no bank account to describe and
     inventing an account number is the one fake this file will not produce. */
  if (req.method === "GET" && req.path === "/v1/linkpay/account") {
    if (!entitled(s)) {
      return fail(403, "Active subscription required.", cid);
    }
    return fail(404, "No LinkPay account has been provisioned for this user.", cid);
  }

  if (req.method === "POST" && req.path === "/v1/subscriptions") {
    const idempotencyKey = str(body.idempotencyKey);
    if (!idempotencyKey) return fail(400, "idempotencyKey is required.", cid);

    // The key is the whole contract: the same key must return the same
    // subscription, however many times it arrives. A stand-in that minted a
    // second checkout on a replayed key would hide the exact bug the key
    // exists to prevent.
    if (s.checkout?.idempotencyKey === idempotencyKey) {
      return reply(
        200,
        { subscription: subscriptionBody(s), payment: paymentBody(s) },
        cid,
      );
    }

    const refundTo = str(body.refundTo);
    if (!refundTo || !/^0x[0-9a-fA-F]{40}$/.test(refundTo)) {
      return fail(400, "refundTo must be a wallet address.", cid);
    }

    const checkout: Checkout = {
      idempotencyKey,
      subscriptionId: id("sub"),
      paymentId: id("pay"),
      originChainId:
        typeof body.originChainId === "number" ? body.originChainId : 8453,
      originAsset: str(body.originAsset) ?? "",
      refundTo,
      createdAt: Date.now(),
    };
    const next: State = {
      ...s,
      checkout,
      activeSince: null,
      cancelAtPeriodEnd: false,
      canceled: false,
    };
    await save(next);

    return reply(
      201,
      { subscription: subscriptionBody(next), payment: paymentBody(next) },
      cid,
    );
  }

  const match = /^\/v1\/subscriptions\/([^/]+)(\/payment|\/cancel)?$/.exec(req.path);
  if (match) {
    const wanted = decodeURIComponent(match[1]);
    const leaf = match[2];

    if (!s.checkout || s.checkout.subscriptionId !== wanted) {
      return fail(404, "Subscription not found.", cid);
    }

    if (leaf === "/payment" && req.method === "GET") {
      const settled = await settleIfDue(s);
      return reply(200, paymentBody(settled), cid);
    }

    if (leaf === "/cancel" && req.method === "POST") {
      // `atPeriodEnd` decides whether the member keeps the month they paid for.
      // The checkout record is kept either way: it holds the subscription's id,
      // and a cancellation that changed the id would leave the screen that
      // asked for it holding a subscription it cannot look up again.
      const atPeriodEnd = body.atPeriodEnd !== false;
      const next: State = atPeriodEnd
        ? { ...s, cancelAtPeriodEnd: true }
        : { ...s, cancelAtPeriodEnd: false, canceled: true };
      await save(next);
      return reply(200, subscriptionBody(next), cid);
    }

    if (!leaf && req.method === "GET") {
      const settled = await settleIfDue(s);
      return reply(200, subscriptionBody(settled), cid);
    }
  }

  return null;
}

/* ---------------------------------------------------------------- dispatch */

const unimplemented = new Set<string>();

/**
 * Answer one request. Called only from `client.ts`, and only when
 * `usingPlaceholderGateway` is true.
 */
export async function respond(req: PlaceholderRequest): Promise<Response> {
  announcePlaceholderAuth();
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  // `attempt()` reads the caller's own signal to tell an abort from a network
  // failure, so throwing here lands in the same branch a cancelled fetch would.
  if (req.signal?.aborted) throw new Error("Placeholder request aborted.");

  // `load()` is re-read between the two groups because an auth route may have
  // just replaced the state — a `verify` for a different wallet resets the
  // account, and the membership routes must not answer from the old one.
  const handled =
    (await auth(req, await load())) ?? (await membership(req, await load()));

  if (handled) return handled;

  const route = `${req.method} ${req.path}`;
  if (!unimplemented.has(route)) {
    unimplemented.add(route);
    // Once per route per launch. A screen calling something the stand-in does
    // not answer should read as "not implemented here", not as a broken screen.
    console.warn(
      `[placeholder] ${route} is not implemented by the stand-in gateway — ` +
        "answering 501. Sign-in, entitlement and the membership checkout are.",
    );
  }
  return fail(501, "This route is not implemented by the placeholder gateway.", req.correlationId);
}
