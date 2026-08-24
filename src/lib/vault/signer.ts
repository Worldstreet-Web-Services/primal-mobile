import type { EIP1193Provider } from "viem";

import type { SignAuthorization } from "./wager";

/**
 * The seam between the vault rails and whatever wallet auth eventually
 * provides. Shape derived from what wager.ts/useWager actually consume:
 * an address to play from, an EIP-1193 provider (the 7702 smart account's
 * owner, and the transport for the self-paid fallback send), the EIP-7702
 * authorization signature, and the bearer token the auth-gated bundler
 * proxy wants.
 *
 * Ark satisfies this with Privy's embedded wallet; KashPlus's auth isn't
 * built yet, so the stub below holds the seat. When auth lands, implement
 * VaultSigner once and hand it to setVaultSigner — nothing else changes.
 */
export interface VaultSigner {
  /** The embedded EOA that plays, claims, and receives the pot. */
  getAddress(): Promise<`0x${string}`>;
  /** Provider for the same wallet — must answer eth_sendTransaction, and
   * ideally wallet_switchEthereumChain (the direct path pins it to Base). */
  getProvider(): Promise<EIP1193Provider>;
  /** EIP-7702 authorization signing — upgrades the EOA in place to the
   * Simple Account implementation so its gas can be sponsored. */
  signAuthorization: SignAuthorization;
  /** Session bearer for the auth-gated wsws bundler proxy, or null when
   * there is no session to offer — the sponsor walk then leans on the
   * direct Alchemy endpoint. */
  getAccessToken(): Promise<string | null>;
}

const NOT_WIRED =
  "Sign-in isn't wired yet — plays need an authenticated wallet.";

/** Default seat-holder: every capability refuses, loudly and identically,
 * so a tap on Play/Claim surfaces one honest sentence instead of crashing. */
export const stubSigner: VaultSigner = {
  getAddress: async () => {
    throw new Error(NOT_WIRED);
  },
  getProvider: async () => {
    throw new Error(NOT_WIRED);
  },
  signAuthorization: async () => {
    throw new Error(NOT_WIRED);
  },
  getAccessToken: async () => {
    throw new Error(NOT_WIRED);
  },
};

/** The active signer. Live binding — consumers read it at call time, so a
 * swap mid-session takes effect on the very next action. */
export let vaultSigner: VaultSigner = stubSigner;

/** Pass null on sign-out to fall back to the refusing stub — a stale signer
 *  outliving its session is a play charged to a wallet nobody is holding. */
export function setVaultSigner(signer: VaultSigner | null): void {
  vaultSigner = signer ?? stubSigner;
}
