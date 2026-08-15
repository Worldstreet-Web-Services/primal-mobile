/**
 * Decane sign-in for a React Native app.
 *
 * `decane-connect-kit` 2.5.0 is a **web SDK** — React 18 peer dep, sessions in
 * localStorage, device key-share in IndexedDB, WebAuthn passkeys, wallet
 * detection off `window`. There is no React Native or Expo package, so it
 * cannot be imported here at all (PRD §F1, confirmed against kit.decane.app
 * 2026-08-14).
 *
 * The supported path is therefore the hosted auth surface: a small web page of
 * ours runs Decane Kit in `mode: 'social'` with `authMethods: ['google','email']`,
 * and the app opens it in the system auth browser. The page hands the Decane
 * access token back over the `primal://` deep link, and the token is what our
 * backend verifies with `decane-node`.
 *
 * Google and email both resolve inside that page — including email's two-step
 * code entry — so the app needs no email/OTP screens of its own.
 */

import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { parseCallback } from "@/lib/auth/callback";
import { C } from "@/theme/tokens";

/** Base URL of our hosted Decane surface. Unset in design/preview builds. */
const AUTH_URL = (process.env.EXPO_PUBLIC_AUTH_URL ?? "").replace(/\/$/, "");

/**
 * Decane project id (dashboard → API Keys → App ID). Public by design — it is
 * an audience identifier, not a secret, and ships in frontend code.
 *
 * Passed to the surface the way OAuth passes `client_id`, so one deployed
 * surface can serve the test and live projects instead of hardcoding one. The
 * surface forwards it to `<DecaneKit config={{ appId }}>`; the backend checks
 * the same value against the token's `project_id` via `decane-node`.
 *
 * Note: `appId` appears only in the docs' custom-auth examples and is absent
 * from every published `DecaneConfig` / `DecaneConnectConfig` interface, though
 * the dashboard states every integration needs it. Treated as required here.
 */
const APP_ID = process.env.EXPO_PUBLIC_DECANE_APP_ID ?? "";

/**
 * Mirrors `usingMockApi` in src/lib/api.ts: with no surface deployed yet, the
 * flow resolves locally so onboarding stays walkable. It never mints anything
 * a backend would accept — the token is visibly fake.
 */
export const usingMockAuth = AUTH_URL === "";

export type AuthMethod = "google" | "email";

export interface DecaneSession {
  accessToken: string;
  /** Epoch ms, or null when the surface didn't say. */
  expiresAt: number | null;
  isNewUser: boolean;
}

export type AuthFailureReason =
  | "cancelled"
  | "state_mismatch"
  | "no_token"
  | "provider_error"
  | "unknown";

export class AuthError extends Error {
  constructor(
    public reason: AuthFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** User-facing copy. Never surface a raw provider string to a person. */
export function describeAuthError(error: unknown): { title: string; description: string } {
  if (error instanceof AuthError) {
    switch (error.reason) {
      case "cancelled":
        return { title: "Sign-in cancelled", description: "No changes were made." };
      case "state_mismatch":
        return {
          title: "Sign-in could not be verified",
          description: "The response didn't match this device. Try again.",
        };
      case "no_token":
        return {
          title: "Sign-in incomplete",
          description: "Decane didn't return a session. Try again.",
        };
      case "provider_error":
        return { title: "Sign-in failed", description: error.message };
      default:
        break;
    }
  }
  return {
    title: "Something went wrong",
    description: "Check your connection and try again.",
  };
}

/** The deep link the surface redirects to. `scheme: "primal"` is set in app.json. */
function redirectUri(): string {
  return Linking.createURL("auth/callback");
}

/** Opaque value echoed back by the surface, so another app can't feed us a token. */
function newState(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

async function mockSignIn(method: AuthMethod): Promise<DecaneSession> {
  // Long enough that the button's loading state is actually visible.
  await new Promise((r) => setTimeout(r, 1200));
  return {
    accessToken: `mock.decane.${method}.${Date.now()}`,
    expiresAt: Date.now() + 30 * 60_000, // Decane's default session is 30 minutes.
    isNewUser: true,
  };
}

/**
 * Opens the hosted surface and resolves once it redirects back.
 *
 * `openAuthSessionAsync` is the right primitive rather than `openBrowserAsync`:
 * on iOS it's `ASWebAuthenticationSession`, which shares Safari's cookie jar so
 * a returning user isn't asked to log into Google again, and it closes itself
 * on redirect. Android uses a Custom Tab.
 */
export async function signIn(method: AuthMethod): Promise<DecaneSession> {
  if (usingMockAuth) return mockSignIn(method);

  const redirect = redirectUri();
  const state = newState();
  const url =
    `${AUTH_URL}?method=${encodeURIComponent(method)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&state=${encodeURIComponent(state)}` +
    (APP_ID ? `&app_id=${encodeURIComponent(APP_ID)}` : "");

  const result = await WebBrowser.openAuthSessionAsync(url, redirect, {
    // Matches the app canvas so the sheet doesn't flash white on open.
    controlsColor: C.silver,
    toolbarColor: C.canvas,
    // Deliberately NOT ephemeral: Decane's device key-share lives in this
    // surface's storage, and a private session would discard it every sign-in,
    // forcing recovery on each launch.
    preferEphemeralSession: false,
  });

  if (result.type !== "success") {
    // 'cancel' is the user dismissing; 'dismiss' is a programmatic close.
    throw new AuthError("cancelled", "Sign-in was cancelled.");
  }

  const parsed = parseCallback(result.url, state);
  if (!parsed.ok) throw new AuthError(parsed.reason, parsed.message);

  return {
    accessToken: parsed.accessToken,
    expiresAt: parsed.expiresAt,
    isNewUser: parsed.isNewUser,
  };
}

/**
 * Ends the Decane session in the hosted surface. Clearing our own storage is
 * not enough — the surface keeps its own session, so the next sign-in would
 * silently reuse it and look like the sign-out never happened.
 */
export async function signOutRemote(): Promise<void> {
  if (usingMockAuth) return;
  try {
    await WebBrowser.openAuthSessionAsync(
      `${AUTH_URL}/logout?redirect_uri=${encodeURIComponent(redirectUri())}`,
      redirectUri(),
    );
  } catch {
    // A failed remote sign-out must never strand the user signed in locally.
  }
}
