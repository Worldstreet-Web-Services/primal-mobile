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
  useRef,
  useState,
} from "react";

import { setAccessToken } from "@/lib/api";
import * as biometrics from "@/lib/auth/biometrics";
import * as decane from "@/lib/auth/decane";
import type { AuthMethod, DecaneSession } from "@/lib/auth/decane";
import * as storage from "@/lib/auth/storage";
import * as wire from "@/lib/auth/wire";
import * as gatewayAuth from "@/lib/gateway/auth";
import * as entitlement from "@/lib/gateway/entitlement";
import { forgetPayoutState } from "@/lib/gateway/linkpay";
import { clearVasState } from "@/lib/gateway/services";
import * as gatewaySession from "@/lib/gateway/session";
import {
  ApiError,
  NetworkError,
  SessionExpiredError,
  type MeResponse,
  type PrimalAppState,
} from "@/lib/gateway/types";

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

/**
 * The Primal gateway session — a SECOND layer, stacked on the Decane one.
 *
 * Decane owns the wallet; the gateway owns entitlement, LinkPay and money. A
 * user can hold a perfectly good wallet and no gateway session (first launch
 * after install, or a lapsed refresh token), so the two are tracked apart and
 * the gateway one is (re)established by signing a SIWE challenge with the
 * wallet that already exists.
 */
interface PrimalState {
  /** Where the app should route. Backend-derived; never guessed locally. */
  state: PrimalAppState;
  identity: MeResponse | null;
  /** SIWE or an entitlement probe is in flight. */
  syncing: boolean;
  /**
   * Why the last attempt failed, when it failed for a reason the user can act
   * on (usually "you are offline"). Not an auth failure — those move `state`.
   */
  error: string | null;
}

const IDLE_PRIMAL: PrimalState = {
  state: "unknown",
  identity: null,
  syncing: false,
  error: null,
};

/**
 * User-facing copy for a gateway failure that is not an auth decision.
 *
 * Gateway messages are written for operators — "User Management service is
 * unavailable" is a real 503 body from api.tsion.io — so 5xx is replaced
 * wholesale. 4xx text is passed through: those are things like a rejected
 * signature, where the specific reason is the useful part.
 */
function describeGatewayFailure(error: unknown): string {
  if (NetworkError.is(error)) {
    return error.timedOut
      ? "Primal took too long to answer. Try again."
      : "Could not reach Primal. Check your connection.";
  }
  if (ApiError.is(error)) {
    return error.statusCode >= 500
      ? "Primal is temporarily unavailable. Try again shortly."
      : error.message;
  }
  if (decane.isCancellation(error)) return "Signature cancelled.";
  return decane.describeAuthError(error).description;
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

  /** Gateway layer. Route on `primal.state`, not on `status`, for anything
   *  that costs money or touches LinkPay. */
  primal: PrimalState;
  /** Re-ask the gateway what this session may do. Call after a payment lands,
   *  on foreground, and on a pull-to-refresh — it is a single cheap GET. */
  refreshEntitlement: () => Promise<void>;
  /** Retry the SIWE handshake after a network failure. */
  linkPrimal: () => Promise<void>;
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
  const [primal, setPrimal] = useState<PrimalState>(IDLE_PRIMAL);

  /**
   * The in-flight gateway sync. Held in a ref, not state, so the effect below
   * can fire on both `session` and `status` changes (a restored session arrives
   * LOCKED and unlocks later) without ever starting a second SIWE handshake —
   * which would raise a second biometric prompt and burn a second challenge.
   */
  const primalSync = useRef<Promise<void> | null>(null);

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

  // Couple the wallet to the signing seams — the vault rails (plays, claims)
  // and the crypto rails (withdrawals) both read through them. Keyed on the
  // session so it covers restore, sign-in and sign-out in one place; without a
  // session the seams stay on their refusing stubs.
  // Status is a dependency, not just the session: a restored session arrives
  // LOCKED, and the wallet only hands out addresses once it is unlocked — so
  // this has to run again on the transition into `ready`.
  useEffect(() => {
    if (!state.session) {
      wire.unwireWallets();
      return;
    }
    wire.wireWallets(state.session.addresses);
    void wire.primeAddresses();
  }, [state.session, state.status]);

  /**
   * Establish the gateway session for a wallet that already exists, then ask
   * the gateway what it may do.
   *
   * Order matters. `bootstrap()` is tried first so a returning user is not made
   * to sign anything — the stored pair, one serialized refresh behind it, is
   * usually enough. Only when the gateway has genuinely refused does this reach
   * for the wallet and burn a challenge.
   */
  const runPrimalSync = useCallback(async (walletAddress: string) => {
    setPrimal((p) => ({ ...p, syncing: true, error: null }));

    try {
      let identity = (await gatewayAuth.bootstrap()).identity;

      if (!identity) {
        await gatewayAuth.signInWithWallet(walletAddress, decane.signMessage);
        identity = await gatewayAuth.me();
      }

      const snapshot = await entitlement.probeEntitlement();
      setPrimal({
        state: snapshot.state,
        identity,
        syncing: false,
        error: null,
      });
    } catch (error) {
      setPrimal((p) => ({
        ...p,
        // A dead session is a routing decision; everything else is a message.
        // Notably NOT a downgrade to `authenticated_unpaid` — a request that
        // never arrived says nothing about whether this user has paid.
        state: SessionExpiredError.is(error) ? "session_expired" : p.state,
        identity: SessionExpiredError.is(error) ? null : p.identity,
        syncing: false,
        error: SessionExpiredError.is(error) ? null : describeGatewayFailure(error),
      }));
    }
  }, []);

  // Link the wallet to the gateway once one exists AND is unlocked. Signing is
  // what forces the second condition: on the passkey and enclave tiers it
  // raises a biometric prompt, which behind the lock screen would be a prompt
  // the user cannot explain.
  useEffect(() => {
    const address = state.session?.addresses.evm;

    if (!state.session || !address) {
      // `loading` has not decided anything yet — only a settled sign-out is
      // anonymous, and clearing on `loading` would flash the sign-in route.
      if (state.status === "signedOut") setPrimal({ ...IDLE_PRIMAL, state: "anonymous" });
      return;
    }

    if (state.status !== "ready" && state.status !== "onboarding") return;

    // Web and credential-less builds have no real wallet to sign with; the
    // gateway layer stays inert rather than failing a handshake on "0xMOCK".
    if (decane.usingMockAuth) {
      setPrimal({ ...IDLE_PRIMAL, state: "anonymous" });
      return;
    }

    if (primalSync.current) return;
    const run = runPrimalSync(address).finally(() => {
      primalSync.current = null;
    });
    primalSync.current = run;
  }, [state.session, state.status, runPrimalSync]);

  // The client clears storage when a refresh is refused outright. That can
  // happen mid-request, far from here, so react to the store rather than
  // waiting for the next screen to discover it.
  useEffect(
    () =>
      gatewaySession.subscribe((next) => {
        if (next === null) {
          setPrimal((p) =>
            p.identity
              ? { state: "session_expired", identity: null, syncing: false, error: null }
              : p,
          );
        }
      }),
    [],
  );

  /**
   * Re-ask the gateway. One cheap GET — call it on foreground, after a payment
   * lands, and while `payment_pending`/`entitlement_syncing` are on screen.
   */
  const refreshEntitlement = useCallback(async () => {
    if (!(await gatewaySession.hasSession())) return;
    setPrimal((p) => ({ ...p, syncing: true }));
    try {
      const snapshot = await entitlement.probeEntitlement();
      setPrimal((p) => ({ ...p, state: snapshot.state, syncing: false, error: null }));
    } catch (error) {
      setPrimal((p) => ({
        ...p,
        state: SessionExpiredError.is(error) ? "session_expired" : p.state,
        identity: SessionExpiredError.is(error) ? null : p.identity,
        syncing: false,
        error: SessionExpiredError.is(error) ? null : describeGatewayFailure(error),
      }));
    }
  }, []);

  /** Retry the handshake after a failure the user has since fixed. */
  const linkPrimal = useCallback(async () => {
    const address = state.session?.addresses.evm;
    if (!address || decane.usingMockAuth) return;
    // Same gate as the automatic handshake below: signing raises a biometric
    // prompt on the passkey and enclave tiers, and behind the lock screen that
    // is a prompt the user cannot explain. A caller retrying by hand must not
    // reach past a guard the automatic path respects.
    if (state.status !== "ready" && state.status !== "onboarding") return;
    if (primalSync.current) return primalSync.current;
    const run = runPrimalSync(address).finally(() => {
      primalSync.current = null;
    });
    primalSync.current = run;
    return run;
  }, [state.session, state.status, runPrimalSync]);

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
    // Revoke the Primal refresh session before the wallet goes: once Decane is
    // disconnected there is no signer left to prove ownership, and a live
    // refresh token left on the server outlives the sign-out that was meant to
    // end it. `logout` clears local storage whatever the network does.
    await gatewayAuth.logout();
    await entitlement.forgetSubscriptionId();
    // Money state is per-user but the keychain is per-device: without this the
    // next account on this handset inherits the last one's in-flight payout
    // record and attempt ledgers, and a confirm screen would narrate a stranger's
    // transfer as their own. Sign-out is the only safe moment to drop them —
    // they exist to survive crashes and timeouts everywhere else.
    await forgetPayoutState();
    clearVasState();
    await decane.signOut();
    await storage.clearAll();

    primalSync.current = null;
    setPrimal({ ...IDLE_PRIMAL, state: "anonymous" });
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
      primal,
      refreshEntitlement,
      linkPrimal,
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
      primal,
      refreshEntitlement,
      linkPrimal,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
