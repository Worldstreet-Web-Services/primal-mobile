/**
 * The single source of truth for "who is signed in, and how far through
 * onboarding are they" — the app's read of LinkPay's `onboardingStep` machine
 * (PRD §F1).
 *
 * Route files never call the Decane client or SecureStore directly; they read
 * this and navigate. That keeps the web-surface workaround in one place, so
 * swapping it for a native Decane SDK later touches this file alone.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { setAccessToken } from "@/lib/api";
import * as biometrics from "@/lib/auth/biometrics";
import { AuthError, signIn as decaneSignIn, signOutRemote } from "@/lib/auth/decane";
import type { AuthMethod, DecaneSession } from "@/lib/auth/decane";
import * as storage from "@/lib/auth/storage";

/**
 * `loading`  — reading storage on launch; nothing decided yet.
 * `signedOut`— no Decane session.
 * `onboarding` — signed in, but PIN/passkey steps outstanding.
 * `locked`   — signed in and onboarded, app needs unlocking this launch.
 * `ready`    — unlocked; the tab shell is safe to show.
 */
export type AuthStatus = "loading" | "signedOut" | "onboarding" | "locked" | "ready";

/** Mirrors the backend's `onboardingStep`; `complete` is the terminal state. */
export type OnboardingStep = "pin" | "passkey" | "complete";

interface AuthState {
  status: AuthStatus;
  step: OnboardingStep;
  session: DecaneSession | null;
  /** True while a sign-in round-trip is in flight, per method. */
  pending: AuthMethod | null;
}

interface AuthApi extends AuthState {
  signIn: (method: AuthMethod) => Promise<void>;
  signOut: () => Promise<void>;
  createPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<biometrics.BiometricOutcome>;
  enableBiometrics: () => Promise<biometrics.BiometricOutcome>;
  skipBiometrics: () => Promise<void>;
  capability: biometrics.BiometricCapability | null;
}

const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    step: "pin",
    session: null,
    pending: null,
  });
  const [capability, setCapability] = useState<biometrics.BiometricCapability | null>(null);

  // Launch: restore whatever the Keychain still holds and decide where the
  // user belongs, before the first frame of UI commits to a route.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [stored, pinSet, cap] = await Promise.all([
        storage.loadSession(),
        storage.hasPin(),
        biometrics.getCapability(),
      ]);
      if (cancelled) return;

      setCapability(cap);

      const expired = stored?.expiresAt != null && stored.expiresAt <= Date.now();
      if (!stored || expired) {
        // An expired token is worthless to the backend; drop it rather than
        // carry it into a request that will 401.
        if (expired) await storage.clearSession();
        setState({ status: "signedOut", step: "pin", session: null, pending: null });
        return;
      }

      setAccessToken(stored.accessToken);
      const session: DecaneSession = { ...stored, isNewUser: false };

      setState({
        status: pinSet ? "locked" : "onboarding",
        step: pinSet ? "complete" : "pin",
        session,
        pending: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (method: AuthMethod) => {
    setState((s) => ({ ...s, pending: method }));
    try {
      const session = await decaneSignIn(method);
      await storage.saveSession(session);
      setAccessToken(session.accessToken);

      // A returning user who still has a PIN skips straight past onboarding.
      const pinSet = await storage.hasPin();
      setState({
        status: pinSet ? "ready" : "onboarding",
        step: pinSet ? "complete" : "pin",
        session,
        pending: null,
      });
    } catch (error) {
      setState((s) => ({ ...s, pending: null }));
      throw error instanceof AuthError
        ? error
        : new AuthError("unknown", "Sign-in failed.");
    }
  }, []);

  const signOut = useCallback(async () => {
    setAccessToken(null);
    await storage.clearAll();
    await signOutRemote();
    setState({ status: "signedOut", step: "pin", session: null, pending: null });
  }, []);

  const createPin = useCallback(async (pin: string) => {
    await storage.savePin(pin);
    setState((s) => ({ ...s, status: "onboarding", step: "passkey" }));
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await storage.verifyPin(pin);
    if (ok) setState((s) => ({ ...s, status: "ready", step: "complete" }));
    return ok;
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    const outcome = await biometrics.authenticate("Unlock Primal");
    if (outcome.ok) setState((s) => ({ ...s, status: "ready", step: "complete" }));
    return outcome;
  }, []);

  const enableBiometrics = useCallback(async () => {
    const outcome = await biometrics.authenticate("Enable biometric unlock");
    if (outcome.ok) {
      await storage.setBiometricsEnabled(true);
      setState((s) => ({ ...s, status: "ready", step: "complete" }));
    }
    return outcome;
  }, []);

  const skipBiometrics = useCallback(async () => {
    await storage.setBiometricsEnabled(false);
    setState((s) => ({ ...s, status: "ready", step: "complete" }));
  }, []);

  const value = useMemo<AuthApi>(
    () => ({
      ...state,
      capability,
      signIn,
      signOut,
      createPin,
      unlockWithPin,
      unlockWithBiometrics,
      enableBiometrics,
      skipBiometrics,
    }),
    [
      state,
      capability,
      signIn,
      signOut,
      createPin,
      unlockWithPin,
      unlockWithBiometrics,
      enableBiometrics,
      skipBiometrics,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
