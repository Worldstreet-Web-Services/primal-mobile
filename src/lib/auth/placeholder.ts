/**
 * The stand-in wallet, for a build with no Decane credentials.
 *
 * Decane owns sign-in, key custody and signing. With no `EXPO_PUBLIC_DECANE_*`
 * values the SDK cannot initialise at all, so `usingMockAuth` in `decane.ts`
 * has always had a fallback — but the old one returned a throwaway object with
 * the address `"0xMOCK"`, which meant three things were true at once: the
 * session did not survive a relaunch, nothing could be signed, and no gateway
 * would ever accept that address. The app could sign in and go nowhere.
 *
 * This replaces it with a wallet that behaves like a wallet:
 *
 * - **A real-shaped address.** 20 bytes of hex, prefixed `0xdead…` so it is
 *   recognisable on sight as a stand-in. Real shape matters because the address
 *   is what the SIWE message carries, what `refundTo` is validated against, and
 *   what the app compares to detect a wallet change.
 * - **Minted per sign-in.** Each sign-in is a NEW address, which is what makes
 *   it a new account: the placeholder gateway keys membership to the wallet, so
 *   signing out and back in walks the full onboarding sequence again rather
 *   than landing on a paid account nobody paid for.
 * - **Persisted.** It survives a relaunch, so a returning user is restored the
 *   way a returning user is — locked, onboarded, and still a member.
 *
 * Nothing here can sign anything a chain would accept, and nothing should try:
 * `signMessage` returns a well-formed but meaningless signature purely so the
 * placeholder gateway's handshake has something of the right shape to receive.
 * This module is inert unless `placeholderAuth` is on, and that is `__DEV__`
 * only.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthMethod, DecaneSession } from "@/lib/auth/decane";

const KEY = "paradigm.auth.placeholder_wallet";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.auth",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** SecureStore is native-only — see the note in `storage.ts`. */
const isWeb = Platform.OS === "web";

/** Web keeps the wallet for the life of the tab; there is no keychain there. */
let memory: StoredWallet | null = null;

interface StoredWallet {
  address: string;
  method: AuthMethod;
  createdAt: number;
}

/* ------------------------------------------------------------ random hex */

function randomHex(chars: number): string {
  let out = "";
  while (out.length < chars) {
    try {
      out += Crypto.randomUUID().replace(/-/g, "");
    } catch {
      // expo-crypto is a native module. A preview build without it must not
      // take sign-in down over a value that is a placeholder anyway.
      out += Math.random().toString(16).slice(2).padEnd(13, "0");
    }
  }
  return out.slice(0, chars);
}

/**
 * A 20-byte address that announces itself.
 *
 * `dead` is not decoration. Every other placeholder in this codebase is
 * readable as one at a glance (`0xMOCK`, `MOCKsol`), and an address that looked
 * like an ordinary wallet would be the one piece of fake data here that a
 * person could mistake for somewhere to send money.
 */
function mintAddress(): string {
  return `0xdead${randomHex(36)}`;
}

/* ---------------------------------------------------------------- storage */

async function read(): Promise<StoredWallet | null> {
  if (isWeb) return memory;
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredWallet;
    return typeof parsed?.address === "string" && parsed.address !== ""
      ? parsed
      : null;
  } catch {
    // Corrupt, or a keychain that will not open: sign in again.
    return null;
  }
}

async function write(wallet: StoredWallet): Promise<void> {
  if (isWeb) {
    memory = wallet;
    return;
  }
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(wallet), OPTIONS);
  } catch {
    // Costs only the ability to restore on the next launch.
  }
}

/* ------------------------------------------------------------- the wallet */

function toSession(wallet: StoredWallet, isNewUser: boolean): DecaneSession {
  return {
    // EVM only, deliberately. The Solana and Tron addresses are not needed by
    // any step this stands in for, and inventing two more would put two more
    // unspendable addresses on screen. `null` renders as "no address", which is
    // the honest thing for a wallet that does not exist to say.
    addresses: { evm: wallet.address },
    isNewUser,
    accessToken: `placeholder.decane.${wallet.method}.${wallet.createdAt}`,
    // Long enough that no session in a dev run expires mid-flow; the gateway
    // stand-in tracks its own token lifetimes independently.
    expiresAt: wallet.createdAt + 30 * 24 * 60 * 60_000,
  };
}

/** Sign in: mint a fresh wallet, and with it a fresh account. */
export async function signIn(method: AuthMethod): Promise<DecaneSession> {
  // The real SDK takes a beat here — key generation, an unlock-tier probe, a
  // network round trip. Screens have progress states for it, and a stand-in
  // that returned instantly would leave them untested.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const wallet: StoredWallet = {
    address: mintAddress(),
    method,
    createdAt: Date.now(),
  };
  await write(wallet);
  return toSession(wallet, true);
}

/** Launch path: whatever was minted last, or `null` if sign-in is needed. */
export async function restoreSession(): Promise<DecaneSession | null> {
  const wallet = await read();
  return wallet ? toSession(wallet, false) : null;
}

export async function signOut(): Promise<void> {
  memory = null;
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(KEY, OPTIONS);
  } catch {
    // Nothing to do — the caller clears the rest of the local state regardless.
  }
}

/**
 * A signature of the right SHAPE and no cryptographic meaning whatsoever.
 *
 * 65 bytes, hex, `0x`-prefixed: what `verify` on the placeholder gateway checks
 * for, and nothing more. It recovers to no address, and the real gateway would
 * reject it — which is correct, because this only ever reaches the stand-in.
 */
export async function signMessage(message: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message,
  ).catch(() => randomHex(64));
  return `0x${digest}${randomHex(66)}`.slice(0, 132);
}
