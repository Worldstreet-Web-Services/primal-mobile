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
import {
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

/* -------------------------------------------------------------- endpoints */

/** Mint a one-time challenge. Single-use, and it expires. */
export function challenge(walletAddress: string): Promise<ChallengeResponse> {
  return client.post<ChallengeResponse>(
    "/v1/auth/challenge",
    { walletAddress },
    // Replayable: minting a second challenge costs nothing and invalidates
    // nothing — the one we end up signing is the one we send back.
    { auth: false, retry: true },
  );
}

/**
 * Exchange a signed challenge for a token pair, and store it.
 *
 * Not replayable: challenges are single-use, so a replay after a timeout is
 * rejected as a stale nonce even though the first attempt may have created a
 * perfectly good session.
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
  return session.save(response);
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
 * Local state is cleared whatever happens. A user who taps sign out on a plane
 * is signed out; the refresh token is already useless to them, and the server
 * copy lapses on its own.
 */
export async function logout(): Promise<void> {
  const refreshToken = await session.getRefreshToken();
  try {
    if (refreshToken) {
      await client.post<{ revoked: boolean }>(
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
 * The full SIWE handshake: challenge → sign → verify → store.
 *
 * `walletAddress` is the wallet's own EVM address as Decane reports it. It is
 * passed through untouched — no checksumming, no lowercasing. The gateway
 * embeds the address in the message it returns, and the signature only recovers
 * if the message is signed exactly as issued.
 */
export async function signInWithWallet(
  walletAddress: string,
  sign: MessageSigner,
): Promise<StoredSession> {
  const issued = await challenge(walletAddress);
  const signature = await sign(issued.message);
  return verify(issued.message, signature);
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
 */
export async function bootstrap(): Promise<Bootstrap> {
  const stored = await session.load();
  if (!stored) return { identity: null, stored: null };

  try {
    const identity = await me();
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
