/**
 * Decane sign-in, native.
 *
 * Supersedes the hosted-web-surface workaround: `decane-connect-kit-expo`
 * (0.1.2, 2026-08-15) is a real headless React Native SDK, so the browser
 * round-trip, the deep-link callback contract and `docs/auth-surface.md` are
 * all gone. Sign-in, key custody and signing happen in-process.
 *
 * KingsChat is a first-class `authMethod` here — the PRD's bridge issuer
 * (KingsChat OAuth → ES256 JWT + JWKS) is no longer needed at all.
 *
 * ⚠ Passkey sign-in requires a development build, but the module as a whole is
 * Expo Go safe. `expo-secure-store` ships inside Expo Go, and the kit reaches
 * `react-native-passkeys` only through its `optional()` try/catch wrapper — in
 * Expo Go `requireNativeModule("ReactNativePasskeys")` throws at import, the
 * catch swallows it, and sign-in degrades to the non-passkey tiers.
 *
 * The "app opens and closes instantly with nothing in the Metro logs" symptom
 * is NOT this module. It is an Expo Go SDK mismatch: Expo Go embeds exactly one
 * SDK and must equal the `expo` version in package.json (57). App Store Expo Go
 * is capped at SDK 54, so a matching client has to come from expo.dev/go
 * (Android) or sign.expo.dev / `eas go` (iOS). See README.
 */

import {
  createDecaneConnect,
  DecaneConnectError,
  UserCancelledError,
  type Chain,
  type DecaneConnectNative,
} from "decane-connect-kit-expo";
import { Platform } from "react-native";

const APP_ID = process.env.EXPO_PUBLIC_DECANE_APP_ID ?? "";

/**
 * Public by necessity, not by choice: the native SDK takes the key client-side,
 * so it ships in the bundle and is extractable from the binary. The dashboard's
 * `callback_url` allowlist is what actually constrains it — the backend
 * redirects only to that registered value, never to one supplied at call time.
 */
const API_KEY = process.env.EXPO_PUBLIC_DECANE_API_KEY ?? "";

/**
 * WebAuthn relying-party ID. There is no default on native (the web SDK falls
 * back to `window.location.hostname`, which means nothing here). Without it the
 * SDK *silently* drops to the secure-enclave tier — no error, no passkey
 * sign-in — so its absence is warned about loudly below.
 */
const RP_ID = process.env.EXPO_PUBLIC_DECANE_RP_ID ?? "";

/**
 * Must match `scheme` in app.json AND the API key's `callback_url` in the
 * dashboard, exactly. Hardcoded rather than derived from `Linking.createURL`
 * because the dashboard stores one literal string and the backend refuses
 * anything else.
 */
export const REDIRECT_URI = "paradigm://auth";

/** Chains the wallet is provisioned for. Base carries the Worldstreet remit leg (PRD §F3). */
const CHAINS: Chain[] = ["evm:8453", "evm:1", "solana:mainnet", "tron:mainnet"];

/**
 * Mirrors `usingMockApi` in src/lib/api.ts. Two reasons to fall back:
 *
 * 1. **No credentials** — the SDK cannot initialise, so onboarding stays
 *    walkable rather than the app being unusable for anyone without them.
 * 2. **Web** — this package is native-only (secure-store, passkeys, keystore).
 *    `expo start --web` is a layout-preview target; real sign-in needs a
 *    development build.
 */
export const usingMockAuth =
  Platform.OS === "web" || API_KEY === "" || APP_ID === "";

export type AuthMethod = "google" | "email" | "kingschat";

export interface DecaneSession {
  addresses: { evm?: string; solana?: string; tron?: string };
  isNewUser: boolean;
  accessToken: string | null;
  expiresAt: number | null;
}

/**
 * The PIN tier is only reached when neither passkeys nor the secure enclave are
 * available, but when it is reached the SDK needs the user's actual PIN — which
 * we deliberately never store (only a salted hash). So the app registers a
 * prompt here and the SDK calls it.
 */
type PinPrompt = () => Promise<string>;
let pinPrompt: PinPrompt | null = null;

export function setPinPrompt(prompt: PinPrompt | null): void {
  pinPrompt = prompt;
}

let client: DecaneConnectNative | null = null;
let initialising: Promise<DecaneConnectNative> | null = null;

/**
 * Built once and reused — construction restores a persisted session, so a
 * second instance would race the first over the same keystore entries.
 */
export async function getClient(): Promise<DecaneConnectNative> {
  if (client) return client;
  if (initialising) return initialising;

  if (usingMockAuth) {
    throw new Error(
      "Decane is not configured — set EXPO_PUBLIC_DECANE_APP_ID and EXPO_PUBLIC_DECANE_API_KEY.",
    );
  }

  if (!RP_ID && __DEV__) {
    console.warn(
      "[decane] EXPO_PUBLIC_DECANE_RP_ID is unset — the passkey tier is unavailable " +
        "and the SDK will silently use the secure-enclave tier instead.",
    );
  }

  initialising = createDecaneConnect({
    appId: APP_ID,
    apiKey: API_KEY,
    chains: CHAINS,
    authMethods: ["kingschat", "google", "email"],
    redirectUri: REDIRECT_URI,

    // Passkey tier first — the SDK's own default order, stated explicitly so a
    // later edit can't reorder it by accident. Each tier is probed with a real
    // ceremony, so a device that claims passkey support but returns no PRF
    // output falls through rather than ending up with an unopenable wallet.
    ...(RP_ID ? { rpId: RP_ID, rpName: "Paradigm" } : {}),
    unlockPreference: ["passkey", "secure-enclave", "pin"],

    promptPin: async () => {
      if (!pinPrompt) {
        throw new Error("PIN tier reached with no prompt registered.");
      }
      return pinPrompt();
    },

    // Sessions survive an app restart — backgrounding a phone is not sign-out.
    // Real expiry is still recorded and re-checked on load.
    persistSession: true,
  })
    .then((c) => {
      client = c;
      return c;
    })
    .finally(() => {
      initialising = null;
    });

  return initialising;
}

async function mockSignIn(method: AuthMethod): Promise<DecaneSession> {
  await new Promise((r) => setTimeout(r, 1200));
  return {
    addresses: { evm: "0xMOCK", solana: "MOCKsol", tron: "TMOCK" },
    isNewUser: true,
    accessToken: `mock.decane.${method}.${Date.now()}`,
    expiresAt: Date.now() + 120 * 60_000,
  };
}

/**
 * Google and KingsChat open an in-app auth sheet (ASWebAuthenticationSession on
 * iOS, Chrome Custom Tab on Android) and return to REDIRECT_URI. The app is
 * never backgrounded. Email is two-step — see `startEmailSignIn`.
 */
export async function signIn(
  method: Exclude<AuthMethod, "email">,
): Promise<DecaneSession> {
  if (usingMockAuth) return mockSignIn(method);

  // Staged so a failure names the step. `createDecaneConnect` and the connect
  // call fail for entirely different reasons (bad key / unlinked native module
  // vs. rejected redirect), and both used to surface identically.
  let decane: DecaneConnectNative;
  try {
    decane = await getClient();
  } catch (error) {
    logAuthError("createDecaneConnect", error);
    throw error;
  }

  try {
    const result =
      method === "kingschat"
        ? await decane.connectWithKingsChat()
        : await decane.connectWithGoogle();
    return toSession(decane, result.addresses, result.isNewUser);
  } catch (error) {
    if (!isCancellation(error)) logAuthError(`connectWith:${method}`, error);
    throw error;
  }
}

export async function startEmailSignIn(email: string): Promise<void> {
  if (usingMockAuth) {
    await new Promise((r) => setTimeout(r, 600));
    return;
  }
  const decane = await getClient();
  await decane.connectWithEmail(email);
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<DecaneSession> {
  if (usingMockAuth) return mockSignIn("email");
  const decane = await getClient();
  const result = await decane.verifyEmailCode(email, code);
  return toSession(decane, result.addresses, result.isNewUser);
}

/** Returning user whose passkey-wrapped share is still on this device. */
export async function canSignInWithPasskey(): Promise<boolean> {
  if (usingMockAuth) return false;
  try {
    const decane = await getClient();
    return await decane.canSignInWithPasskey();
  } catch {
    return false;
  }
}

export async function signInWithPasskey(): Promise<DecaneSession> {
  const decane = await getClient();
  const result = await decane.signInWithPasskey();
  return toSession(decane, result.addresses, result.isNewUser);
}

/** Restores whatever the SDK persisted, or null if sign-in is needed again. */
export async function restoreSession(): Promise<DecaneSession | null> {
  if (usingMockAuth) return null;
  try {
    const decane = await getClient();
    const addresses = decane.getAddresses();
    if (!addresses || decane.needsReconnect()) return null;
    return toSession(decane, addresses, false);
  } catch {
    // A corrupt or superseded share must not wedge the app on launch.
    return null;
  }
}

export async function unlock(): Promise<void> {
  const decane = await getClient();
  await decane.unlock();
}

/**
 * Sign a plain message with the wallet's EVM key.
 *
 * The Primal gateway's SIWE handshake is the only caller: it hands back a
 * challenge string that must be signed **byte for byte as issued**, so nothing
 * here trims, re-wraps or normalises it — a message that has been touched
 * recovers to a different address and the gateway rejects it without saying so.
 *
 * Requires an unlocked wallet. On the passkey and enclave tiers this raises a
 * biometric prompt, which is why the caller waits for the app to leave `locked`
 * before asking.
 */
export async function signMessage(
  message: string,
  chain: Chain = "evm:8453",
): Promise<string> {
  const decane = await getClient();
  return decane.signMessage({ chain, message });
}

/**
 * Ends the Decane session and drops our client.
 *
 * Only disconnects a client that already exists — going through `getClient()`
 * would *construct* one (restoring a persisted session) purely to tear it down,
 * which on a failed-init device turns sign-out into a second error.
 *
 * Note `disconnect()` is the whole of sign-out: the device key share stays, by
 * design, so signing in again restores the wallet without recovery. Wiping it
 * is `clearDeviceState`, which the SDK documents as a repair tool for shares
 * that can no longer be unlocked — not a logout.
 */
export async function signOut(): Promise<void> {
  const existing = client ?? (initialising ? await initialising.catch(() => null) : null);

  try {
    if (existing) await existing.disconnect();
  } catch (error) {
    // Never leave the user stuck signed in because the network hiccuped —
    // local state is cleared regardless by the caller.
    logAuthError("disconnect", error);
  } finally {
    client = null;
    initialising = null;
  }
}

/** Subscribe to SDK lifecycle events; returns an unsubscribe function. */
export async function onSdkEvent(
  event: "wallet-creating" | "wallet-unlocking" | "session-expired" | "disconnected",
  handler: () => void,
): Promise<() => void> {
  if (usingMockAuth) return () => {};
  const decane = await getClient();
  decane.on(event, handler);
  return () => decane.off(event, handler);
}

function toSession(
  decane: DecaneConnectNative,
  addresses: DecaneSession["addresses"],
  isNewUser: boolean,
): DecaneSession {
  return {
    addresses,
    isNewUser,
    accessToken: decane.getAccessToken(),
    expiresAt: decane.sessionExpiresAt(),
  };
}

/**
 * Full detail to the console, once, at the point of failure.
 *
 * `describeAuthError` deliberately returns vague copy — a user can do nothing
 * with `STALE_DEVICE_SHARE`. But vague copy with nothing logged behind it is
 * undebuggable, which is exactly how "Something went wrong" became a dead end.
 * `stage` says which step failed, since the SDK surfaces several errors as the
 * same shape.
 */
export function logAuthError(stage: string, error: unknown): void {
  const detail: Record<string, unknown> = { stage };

  if (error instanceof DecaneConnectError) {
    detail.kind = "DecaneConnectError";
    detail.code = error.code;
    detail.retryable = (error as { retryable?: boolean }).retryable;
    detail.message = error.message;
  } else if (error instanceof Error) {
    detail.kind = error.name;
    detail.message = error.message;
    detail.stack = error.stack;
  } else {
    detail.kind = typeof error;
    detail.value = error;
  }

  // Errors thrown across the native bridge often carry the useful part in
  // non-enumerable or vendor fields, which JSON.stringify drops.
  console.error("[decane] auth failed", detail, error);
}

/** User-facing copy. Never surface a raw SDK code to a person. */
export function describeAuthError(error: unknown): {
  title: string;
  description: string;
} {
  if (error instanceof UserCancelledError) {
    return { title: "Sign-in cancelled", description: "No changes were made." };
  }

  if (error instanceof DecaneConnectError) {
    switch (error.code) {
      case "NATIVE_MODULE_MISSING":
        return {
          title: "This build is missing a module",
          description: "Rebuild the app — Expo Go can't run Decane.",
        };
      case "INVALID_API_KEY":
        return {
          title: "Sign-in unavailable",
          description: "Decane credentials are missing or revoked.",
        };
      case "NEW_DEVICE":
        return {
          title: "New device",
          description: "Sign in again to restore your wallet on this phone.",
        };
      case "STALE_DEVICE_SHARE":
        return {
          title: "Session out of date",
          description: "Sign in again to refresh this device.",
        };
      case "INVALID_PIN":
        return { title: "Wrong PIN", description: "Try again." };
      case "BIOMETRIC_UNAVAILABLE":
        return {
          title: "Biometrics unavailable",
          description: "Use your PIN instead.",
        };
      case "ATTESTATION_FAILED":
        return {
          title: "Secure enclave check failed",
          description: "Signing is blocked. Try again later.",
        };
      case "NETWORK":
        return {
          title: "Connection problem",
          description: "Check your connection and try again.",
        };
      default:
        break;
    }
  }

  // Unrecognised. In development, put the actual code/name in the toast — the
  // person reading it is us, and "Something went wrong" is not a bug report.
  if (__DEV__) {
    const hint =
      error instanceof DecaneConnectError
        ? `code: ${error.code}`
        : error instanceof Error
          ? `${error.name}: ${error.message}`
          : String(error);
    return { title: "Sign-in failed", description: hint.slice(0, 140) };
  }

  return {
    title: "Something went wrong",
    description: "Check your connection and try again.",
  };
}

export function isCancellation(error: unknown): boolean {
  return (
    error instanceof UserCancelledError ||
    (error instanceof DecaneConnectError && error.code === "USER_CANCELLED")
  );
}
