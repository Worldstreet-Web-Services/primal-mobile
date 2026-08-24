/**
 * Sign-In with Ethereum against the Primal gateway.
 *
 * This is the SECOND auth layer. Decane owns the wallet — the keys, the
 * unlock tiers, the OAuth round trip — and this exchanges a signature from that
 * wallet for a Primal token pair. The two expire independently: a live Decane
 * session with no Primal tokens is normal (it is what `signInWithWallet`
 * fixes), and a Primal session outliving its wallet is not, which is why
 * sign-out clears both.
 *
 * The signer is injected rather than imported. `auth.ts` never reaches into the
 * Decane SDK, so the SIWE handshake can be exercised in a test with a plain
 * viem account, and swapping wallet providers touches one call site.
 */

import * as client from "./client";
import * as session from "./session";
import type { StoredSession } from "./session";
import { isExpired } from "./time";
import {
  ApiError,
  SessionExpiredError,
  type ChallengeResponse,
  type MeResponse,
  type SessionResponse,
} from "./types";

/** The chain the wallet signs on. Base carries the Worldstreet remit leg. */
export const SIWE_CHAIN = "evm:8453" as const;

/**
 * Signs the challenge message. Must return a 0x-prefixed 65-byte hex
 * signature, and must sign the message **byte for byte as given** — a SIWE
 * message that has been trimmed, re-wrapped or newline-normalised recovers to a
 * different address and the gateway rejects it with no clue why.
 */
export type MessageSigner = (message: string) => Promise<string>;

/**
 * Two addresses are the same wallet.
 *
 * EVM addresses are case-insensitive; the case that IS there is an EIP-55
 * checksum, and the two sides of this comparison rarely agree on it — Decane
 * hands back a checksummed address, the gateway echoes whatever it stored, and
 * a lowercase/checksummed pair of the same wallet compared with `===` reads as
 * a wallet change. That false positive would clear a perfectly good session and
 * demand a signature on every launch, so the comparison is deliberately blunt.
 */
export function isSameWallet(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/* -------------------------------------------------------------- endpoints */

/**
 * Mint a one-time challenge. Single-use, and it expires.
 *
 * NOT replayable, and that is about 429 rather than correctness. Minting a
 * second challenge is harmless in itself, but the auth routes carry the
 * gateway's rate limit (observed live: `X-RateLimit-Limit: 120`, and a 429 body
 * of `{"statusCode":429,"message":"Request rate limit exceeded"}` with **no**
 * `Retry-After` header to pace off). With `retry: true` the client's own
 * back-off would fire two more sub-second attempts at the exact endpoint that
 * has just said "stop", which is the retry storm the contract forbids. One
 * attempt; the user-driven retry (`linkPrimal`) is the recovery path.
 */
export function challenge(walletAddress: string): Promise<ChallengeResponse> {
  return client.post<ChallengeResponse>(
    "/v1/auth/challenge",
    { walletAddress },
    { auth: false, retry: false },
  );
}

/**
 * Exchange a signed challenge for a token pair, and store it.
 *
 * Not replayable: challenges are single-use, so a replay after a timeout is
 * rejected as a stale nonce even though the first attempt may have created a
 * perfectly good session. Recovery is a FRESH challenge signed again — see
 * `signInWithWallet` — never a second verify of the same one.
 */
export async function verify(
  message: string,
  signature: string,
): Promise<StoredSession> {
  const response = await client.post<SessionResponse>(
    "/v1/auth/verify",
    { message, signature },
    { auth: false, retry: false },
  );
  // `"signin"` — this call IS the creation of the session, so it opens the
  // store even if a sign-out sealed it while the signature was being collected.
  return session.save(response, "signin");
}

/** Rotate the pair. Delegates to the client so there is one refresh in flight
 *  across the whole app, never a second one started from here. */
export const refresh = client.refreshSession;

/** The identity the gateway reads out of the current access token. */
export function me(options?: { signal?: AbortSignal }): Promise<MeResponse> {
  return client.get<MeResponse>("/v1/auth/me", { signal: options?.signal });
}

/**
 * Revoke the refresh session server-side, then clear it locally.
 *
 * Local state is cleared whatever happens, and that includes the case the
 * contract calls out specifically: a `{"revoked": false}` body. The response is
 * read for nothing at all — not branched on, not surfaced — because "the server
 * had no such session to revoke" and "the server revoked it" both end with this
 * device holding no tokens. A user who taps sign out on a plane is signed out.
 *
 * The access token stays cryptographically valid until its own short expiry, so
 * dropping it here is the ONLY thing that stops it being used. `session.clear()`
 * also seals the store, so a refresh that was already in flight cannot finish
 * and write a live pair back in behind the sign-out.
 */
export async function logout(): Promise<void> {
  try {
    const refreshToken = await session.getRefreshToken();
    if (refreshToken) {
      await client.post<unknown>(
        "/v1/auth/logout",
        { refreshToken },
        { auth: false, retry: false },
      );
    }
  } catch {
    // Best effort by design — see above.
  } finally {
    await session.clear();
  }
}

/* -------------------------------------------------------------- handshake */

/**
 * One pass of challenge → sign → verify.
 *
 * `issued.message` is handed to the signer and then to the gateway as the SAME
 * string object. Nothing between these three lines trims it, re-wraps it or
 * touches its newlines: a SIWE message that has been normalised recovers to a
 * different address, and the gateway's answer to that is an indistinguishable
 * 400 (observed live: `{"statusCode":400,"message":"Bad Request Exception"}`,
 * no `code`, nothing naming the signature).
 */
async function handshakeOnce(
  walletAddress: string,
  sign: MessageSigner,
): Promise<{ session: StoredSession } | { staleChallenge: true }> {
  const issued = await challenge(walletAddress);
  const signature = await sign(issued.message);

  // Collecting the signature raises a biometric prompt on the passkey and
  // enclave tiers, and a user who put the phone down can easily outlive the
  // challenge. Spending a verify to be told so wastes a round trip on the
  // rate-limited route AND consumes nothing useful — go straight for a new one.
  if (isExpired(issued.expiresAt, 0)) return { staleChallenge: true };

  return { session: await verify(issued.message, signature) };
}

/**
 * The full SIWE handshake: challenge → sign → verify → store.
 *
 * `walletAddress` is the wallet's own EVM address as Decane reports it. It is
 * passed through untouched — no checksumming, no lowercasing. The gateway
 * embeds the address in the message it returns, and the signature only recovers
 * if the message is signed exactly as issued.
 *
 * **A challenge is single use, so failure is recovered by re-issuing, never by
 * re-verifying.** At most ONE second pass: a challenge that expired while the
 * user was looking at a biometric prompt is the common case and deserves a
 * retry, while a signer that produces a signature the gateway will not accept
 * would fail identically forever, so the second 400 is final. Anything that is
 * not a 400 — 429, 503, a cancelled signature — is not a stale challenge and
 * gets no second pass at all: re-challenging into a rate limit or an outage is
 * the storm, not the cure.
 */
export async function signInWithWallet(
  walletAddress: string,
  sign: MessageSigner,
): Promise<StoredSession> {
  let first: Awaited<ReturnType<typeof handshakeOnce>>;

  try {
    first = await handshakeOnce(walletAddress, sign);
  } catch (error) {
    // The gateway sends no machine-readable code, so "the challenge went stale"
    // and "that signature is wrong" arrive as the same 400. Re-issuing is
    // correct for the first and merely futile for the second, which is why the
    // budget is one.
    if (!ApiError.is(error) || error.statusCode !== 400) throw error;
    const retried = await handshakeOnce(walletAddress, sign);
    if ("staleChallenge" in retried) {
      throw new SessionExpiredError(
        "Primal challenge expired before it could be signed.",
      );
    }
    return retried.session;
  }

  if ("session" in first) return first.session;

  const retried = await handshakeOnce(walletAddress, sign);
  if ("staleChallenge" in retried) {
    // Twice in a row means the signing step itself is slower than the
    // challenge window, not that this attempt was unlucky.
    throw new SessionExpiredError(
      "Primal challenge expired before it could be signed.",
    );
  }
  return retried.session;
}

/* -------------------------------------------------------------- bootstrap */

export interface Bootstrap {
  /** The identity the gateway confirmed, or `null` if sign-in is needed. */
  identity: MeResponse | null;
  stored: StoredSession | null;
}

/**
 * Launch path: restore the stored pair and prove it still works.
 *
 * `me()` goes through the client, which already handles the "access token
 * lapsed" case with exactly one serialized refresh and one retry. So there are
 * only three outcomes here, and none of them guesses: the gateway confirms the
 * session, the gateway refuses it (cleared, sign in again), or the network is
 * down (tokens kept, try again later — being offline is not being signed out).
 *
 * The stored access token is never decoded to answer any of this. It is a JWT
 * and its claims are readable, which is exactly the temptation: a locally
 * decoded `sub` would let the app skip the round trip and be wrong about a
 * revoked session, a rotated wallet or a server-side sign-out. `GET /v1/auth/me`
 * is the only thing that knows.
 *
 * `expectedWalletAddress` is the wallet Decane currently holds. When it is
 * given and does not match, the stored pair belongs to a DIFFERENT wallet and
 * is dropped unused — the tokens are still cryptographically valid, which is
 * precisely why this has to be explicit: without the check, `me()` succeeds,
 * the app carries on, and every LinkPay balance and payout on screen belongs to
 * the previous wallet while the address in the header belongs to the new one.
 * The check runs against the local copy first so the wrong session costs no
 * network call, and again against the gateway's own answer, which is the
 * authority on who a token actually belongs to.
 */
export async function bootstrap(
  expectedWalletAddress?: string,
): Promise<Bootstrap> {
  const stored = await session.load();
  if (!stored) return { identity: null, stored: null };

  if (
    expectedWalletAddress &&
    !isSameWallet(stored.walletAddress, expectedWalletAddress)
  ) {
    await session.clear();
    return { identity: null, stored: null };
  }

  try {
    const identity = await me();

    if (
      expectedWalletAddress &&
      !isSameWallet(identity.walletAddress, expectedWalletAddress)
    ) {
      // The gateway says this token belongs to someone else. Never rewrite the
      // authenticated address to match the UI — clear, and let the caller earn
      // a session for the wallet it actually has.
      await session.clear();
      return { identity: null, stored: null };
    }

    return { identity, stored };
  } catch (error) {
    if (SessionExpiredError.is(error)) {
      await session.clear();
      return { identity: null, stored: null };
    }
    // Network or gateway trouble: the tokens are still presumed good.
    throw error;
  }
}
