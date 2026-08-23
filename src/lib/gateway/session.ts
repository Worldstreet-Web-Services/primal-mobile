/**
 * Primal token storage.
 *
 * SecureStore only — the Keychain on iOS, Keystore-encrypted preferences on
 * Android. Never AsyncStorage: that is a world-readable SQLite file on a rooted
 * device, and these two strings are the whole session.
 *
 * **The pair is one record.** Refresh tokens rotate: every successful refresh
 * invalidates the token that bought it and issues a new pair. Storing the
 * access and refresh tokens under separate keys means a crash between the two
 * writes leaves a new access token beside a dead refresh token — the user is
 * signed in until the access token lapses, then permanently signed out with no
 * way back. Writing one JSON blob under one key makes replacement atomic by
 * construction, which is the only reason it is shaped this way.
 *
 * This module is pure storage. It performs no HTTP and imports no other gateway
 * module, so `client.ts` can depend on it without a cycle.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { SessionResponse } from "./types";

const KEY = "kashplus.gateway.session";

const OPTIONS: SecureStore.SecureStoreOptions = {
  /** Its own service, separate from `kashplus.auth` — Decane's state and the
   *  gateway's expire independently and must be clearable independently. */
  keychainService: "kashplus.gateway",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Web is a layout-preview target: SecureStore's methods do not exist there and
 * calling one throws. Decane cannot run on web either, so no real session is
 * ever created — this keeps `expo start --web` booting and stores nothing.
 */
const isWeb = Platform.OS === "web";

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  userId: string;
  walletAddress: string;
}

/**
 * Why a pair is being written, which decides whether a `clear()` in the
 * meantime wins.
 *
 * - `"signin"` — a fresh SIWE verify. Always opens the store; this IS the act
 *   of creating a session, so nothing that came before it can veto it.
 * - `"rotate"` — a refresh that swapped one live pair for another. The token it
 *   was built from was read BEFORE the network round trip, so a sign-out landing
 *   mid-flight would otherwise be undone by a write that finished after it:
 *   the user taps sign out, a queued 401 refreshes, and the keychain ends the
 *   sequence holding a perfectly good session nobody asked for. Discarded when
 *   the store has been cleared since.
 *
 * Default is `"rotate"` on purpose: an unlabelled write is the conservative
 * case, so a future caller cannot resurrect a session by forgetting the flag.
 */
export type SaveIntent = "signin" | "rotate";

/**
 * In-memory mirror so the hot path (a bearer header on every request) is not a
 * keychain read. `undefined` means "not yet loaded"; `null` means "loaded, and
 * there is nothing there" — the distinction is what stops a cold start from
 * re-reading SecureStore on every call just because it is empty.
 */
let cache: StoredSession | null | undefined;

/**
 * Set by `clear()`, lifted only by a `"signin"` write. See `SaveIntent` — this
 * is the whole mechanism that stops an in-flight refresh from landing on top of
 * a sign-out that has already happened.
 */
let sealed = false;

/** Notified on every change so the auth layer can react to a forced sign-out. */
type Listener = (session: StoredSession | null) => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(next: StoredSession | null): void {
  cache = next;
  for (const listener of listeners) {
    try {
      listener(next);
    } catch {
      // A bad subscriber must not break token storage.
    }
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  const s = value as StoredSession;
  return (
    typeof s === "object" &&
    s !== null &&
    typeof s.accessToken === "string" &&
    s.accessToken !== "" &&
    typeof s.refreshToken === "string" &&
    s.refreshToken !== ""
  );
}

/** Read the stored pair, hydrating the cache on first call. */
export async function load(): Promise<StoredSession | null> {
  if (cache !== undefined) return cache;
  if (isWeb) {
    cache = null;
    return null;
  }

  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) {
      cache = null;
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredSession(parsed)) {
      // Corrupt or written by an older shape — drop it rather than limp.
      await SecureStore.deleteItemAsync(KEY, OPTIONS);
      cache = null;
      return null;
    }
    cache = parsed;
    return parsed;
  } catch {
    // A keychain that will not open must not wedge launch; the user signs in.
    cache = null;
    return null;
  }
}

/**
 * The gateway's own contract (`SessionResponseDto`) marks all five fields and
 * the nested user as required. Trusting that blindly is what turns a truncated
 * or reshaped body into `accessToken: undefined` on disk — which `load()` then
 * rejects on the NEXT launch, signing the user out long after the moment that
 * caused it, with nothing left to point at. Check here, at the one chokepoint
 * both `/v1/auth/verify` and `/v1/auth/refresh` pass through, so a bad body
 * fails loudly where it happened.
 */
function readSessionResponse(response: SessionResponse): StoredSession {
  const str = (value: unknown): value is string =>
    typeof value === "string" && value !== "";

  const user = (response as { user?: { id?: unknown; walletAddress?: unknown } })?.user;

  if (
    !str(response?.accessToken) ||
    !str(response?.refreshToken) ||
    !str(response?.accessTokenExpiresAt) ||
    !str(response?.refreshTokenExpiresAt) ||
    !str(user?.id) ||
    !str(user?.walletAddress)
  ) {
    // Names the missing shape, never a value — the object being described is a
    // token pair, and this message can reach a log.
    throw new Error("Primal returned an incomplete session.");
  }

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    refreshTokenExpiresAt: response.refreshTokenExpiresAt,
    userId: user.id,
    walletAddress: user.walletAddress,
  };
}

/**
 * Replace the pair atomically. Call this with the ENTIRE response of
 * `/v1/auth/verify` or `/v1/auth/refresh` — never with a single token.
 *
 * Pass `"signin"` for a verify. A rotate that lost the race to a sign-out is
 * dropped rather than written; the returned value still describes what the
 * gateway issued, so a caller mid-request can finish with the token in hand,
 * but nothing about this device claims to be signed in afterwards.
 */
export async function save(
  response: SessionResponse,
  intent: SaveIntent = "rotate",
): Promise<StoredSession> {
  const next = readSessionResponse(response);

  if (intent === "signin") {
    sealed = false;
  } else if (sealed) {
    return next;
  }

  // Publish before the write completes so an in-flight retry picks up the new
  // access token immediately; the write is the durable copy, the cache is the
  // live one.
  publish(next);
  if (!isWeb) {
    try {
      await SecureStore.setItemAsync(KEY, JSON.stringify(next), OPTIONS);
    } catch {
      // Session still works this launch; it just will not survive a restart.
    }
  }
  return next;
}

export async function clear(): Promise<void> {
  // Seal before publishing: a subscriber reacting synchronously to the sign-out
  // must not be able to start something that then writes back in behind it.
  sealed = true;
  publish(null);
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  } catch {
    // Nothing to do — the cache is already empty, which is what callers read.
  }
}

/** The bearer to attach, or `null`. Does not check expiry: the gateway is the
 *  authority on that, and a 401 is handled by one serialized refresh. */
export async function getAccessToken(): Promise<string | null> {
  return (await load())?.accessToken ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await load())?.refreshToken ?? null;
}

/** Synchronous read of the cache for render paths. `undefined` = not loaded. */
export function peek(): StoredSession | null | undefined {
  return cache;
}

export async function hasSession(): Promise<boolean> {
  return (await load()) !== null;
}
