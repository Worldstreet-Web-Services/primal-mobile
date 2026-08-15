/**
 * The single source of truth for "who is signed in, and how far through
 * onboarding are they" — the app's read of LinkPay's `onboardingStep` machine
 * (PRD §F1).
 *
 * Route files never touch the Decane SDK or SecureStore directly; they read
 * this and navigate. The SDK owns the wallet session and key custody; this owns
 * the app-level gate (transaction PIN, biometric app-lock) that Decane has no
 * opinion about.
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
import * as decane from "@/lib/auth/decane";
import type { AuthMethod, DecaneSession } from "@/lib/auth/decane";
import * as storage from "@/lib/auth/storage";

/**
 * `loading`    — restoring the SDK session on launch; nothing decided yet.
 * `signedOut`  — no Decane session.
 * `onboarding` — signed in, PIN/passkey steps outstanding.
 * `locked`     — signed in and onboarded, app needs unlocking this launch.
 * `ready`      — unlocked; the app shell is safe to show.
 */
export type AuthStatus =
  | "loading"
  | "signedOut"
  | "onboarding"
  | "locked"
  | "ready";

/** Mirrors the backend's `onboardingStep`; `complete` is terminal. */
export type OnboardingStep = "pin" | "passkey" | "complete";

interface AuthState {
  status: AuthStatus;
  step: OnboardingStep;
  session: DecaneSession | null;
  /** Which sign-in method is mid-flight. */
  pending: AuthMethod | null;
  /** True during first-time key generation — seconds long, needs progress UI. */
  creatingWallet: boolean;
}

interface AuthApi extends AuthState {
  /**
   * The signed-in wallet's addresses, straight from Decane. Null until a
   * session exists — screens must render a placeholder rather than a
   * plausible-looking fake, since a wrong address is money sent nowhere.
   */
  addresses: DecaneSession["addresses"] | null;
  signIn: (method: Exclude<AuthMethod, "email">) => Promise<void>;
  startEmailSignIn: (email: string) => Promise<void>;
  verifyEmailCode: (email: string, code: string) => Promise<void>;
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
    creatingWallet: false,
  });
  const [capability, setCapability] =
    useState<biometrics.BiometricCapability | null>(null);

  // Launch: let the SDK restore its own session, then decide where the user
  // belongs before the first frame commits to a route.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [session, pinSet, cap] = await Promise.all([
        decane.restoreSession(),
        storage.hasPin(),
        biometrics.getCapability(),
      ]);
      if (cancelled) return;

      setCapability(cap);

      if (!session) {
        setState((s) => ({
          ...s,
          status: "signedOut",
          step: "pin",
          session: null,
        }));
        return;
      }

      setAccessToken(session.accessToken);
      setState((s) => ({
        ...s,
        status: pinSet ? "locked" : "onboarding",
        step: pinSet ? "complete" : "pin",
        session,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // First-time key generation covers the Shamir split, the unlock-tier probe
  // and the first enclave session — the SDK asks us to show progress for it.
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const off = await decane.onSdkEvent("wallet-creating", () => {
        setState((s) => ({ ...s, creatingWallet: true }));
      });
      if (cancelled) off();
      else dispose = off;
    })();

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  const adopt = useCallback(async (session: DecaneSession) => {
    setAccessToken(session.accessToken);

    if (__DEV__ && !session.accessToken) {
      // Sign-in succeeded but produced no JWT — the backend exchange has
      // nothing to send, and that must not look like a clean success.
      console.warn("[decane] connected but getAccessToken() returned null");
    }

    // A returning user who still has a PIN skips straight past onboarding.
    const pinSet = await storage.hasPin();
    setState((s) => ({
      ...s,
      status: pinSet ? "ready" : "onboarding",
      step: pinSet ? "complete" : "pin",
      session,
      pending: null,
      creatingWallet: false,
    }));
  }, []);

  const signIn = useCallback(
    async (method: Exclude<AuthMethod, "email">) => {
      setState((s) => ({ ...s, pending: method }));
      try {
        await adopt(await decane.signIn(method));
      } catch (error) {
        setState((s) => ({ ...s, pending: null, creatingWallet: false }));
        throw error;
      }
    },
    [adopt],
  );

  const startEmailSignIn = useCallback(async (email: string) => {
    setState((s) => ({ ...s, pending: "email" }));
    try {
      await decane.startEmailSignIn(email);
    } catch (error) {
      setState((s) => ({ ...s, pending: null }));
      throw error;
    }
  }, []);

  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      try {
        await adopt(await decane.verifyEmailCode(email, code));
      } catch (error) {
        setState((s) => ({ ...s, creatingWallet: false }));
        throw error;
      }
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    // Order matters: revoke the token first so nothing in flight can keep using
    // it, then end the Decane session, then clear local state. Each step is
    // independent — a failure in one must not leave the user half signed out,
    // which is why `decane.signOut` swallows its own errors.
    setAccessToken(null);
    await decane.signOut();
    await storage.clearAll();

    setState({
      status: "signedOut",
      step: "pin",
      session: null,
      pending: null,
      creatingWallet: false,
    });
  }, []);

  const createPin = useCallback(async (pin: string) => {
    await storage.savePin(pin);
    setState((s) => ({ ...s, status: "onboarding", step: "passkey" }));
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const ok = await storage.verifyPin(pin);
    if (!ok) return false;

    // The app-lock PIN is ours; the wallet has its own unlock, which on the
    // passkey/enclave tiers prompts biometrics rather than reusing this PIN.
    try {
      await decane.unlock();
    } catch {
      // Wallet unlock can be retried at signing time — don't strand the user
      // on the lock screen when their PIN was correct.
    }
    setState((s) => ({ ...s, status: "ready", step: "complete" }));
    return true;
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    const outcome = await biometrics.authenticate("Unlock Paradigm");
    if (outcome.ok) {
      try {
        await decane.unlock();
      } catch {
        // As above — app unlock succeeded; wallet unlock can retry.
      }
      setState((s) => ({ ...s, status: "ready", step: "complete" }));
    }
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
      addresses: state.session?.addresses ?? null,
      capability,
      signIn,
      startEmailSignIn,
      verifyEmailCode,
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
      startEmailSignIn,
      verifyEmailCode,
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
