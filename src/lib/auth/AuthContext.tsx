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

import { onForeground } from "@/lib/appActive";
import * as biometrics from "@/lib/auth/biometrics";
import * as decane from "@/lib/auth/decane";
import type { AuthMethod, DecaneSession } from "@/lib/auth/decane";
import * as storage from "@/lib/auth/storage";
import * as wire from "@/lib/auth/wire";
import * as gatewayAuth from "@/lib/gateway/auth";
import * as entitlement from "@/lib/gateway/entitlement";
import { clearPayoutState } from "@/lib/gateway/linkpay";
import { usingPlaceholderGateway } from "@/lib/gateway/placeholder";
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
  "loading" | "signedOut" | "onboarding" | "locked" | "ready";

/** Mirrors the backend's `onboardingStep`; `complete` is terminal. */
export type OnboardingStep = "pin" | "passkey" | "complete";

interface AuthState {
  status: AuthStatus;
  step: OnboardingStep;
  session: DecaneSession | null;
  /** Which sign-in method is mid-flight. */
  pending: AuthMethod | null;
  /**
   * The user asked for biometric unlock, and it is set up.
   *
   * Separate from `capability`, which only says what the DEVICE can do. Both
   * have to be true before the lock screen offers a biometric: a phone with
   * Face ID enrolled and a user who answered "Maybe later" must get the keypad,
   * or the choice the onboarding step collected meant nothing.
   */
  biometricsEnabled: boolean;
  /** True during first-time key generation — seconds long, needs progress UI. */
  creatingWallet: boolean;
  /**
   * This device has been set up before — there is a PIN (and a biometric
   * answer) bound to an account, left behind by a previous session.
   *
   * Only meaningful while `signedOut`, where it is the difference between a
   * fresh install and someone who signed out five minutes ago. The first gets
   * the pitch; the second gets the sign-in screen, because they have already
   * heard the pitch and already own the account.
   */
  returning: boolean;
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
    // 429's live body is "Request rate limit exceeded" and it arrives with no
    // Retry-After to quote, so there is nothing in it worth showing a person
    // beyond "wait". Everything else 4xx keeps its text: a rejected signature
    // or a refused challenge is a case where the specific reason is the useful
    // part.
    if (error.statusCode === 429) {
      return "Too many attempts. Wait a moment and try again.";
    }
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
  /**
   * End the session.
   *
   * `forget` also wipes the device's app lock — the PIN, the biometric answer
   * and the account they were bound to. That is a SWITCH ACCOUNT, not a sign
   * out: the default leaves the lock in place so the same person signing back
   * in lands straight in the app instead of re-running onboarding.
   */
  signOut: (options?: { forget?: boolean }) => Promise<void>;
  createPin: (pin: string) => Promise<void>;
  /**
   * Close the app lock without ending the session.
   *
   * The counterpart to `unlockWithPin` — what an idle timeout, a long spell in
   * the background, or a "lock now" control asks for. Nothing is signed out and
   * nothing is forgotten: the Decane session, the Primal tokens and the stored
   * PIN all stand, and the next unlock resumes exactly where this left off.
   */
  lock: () => void;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<biometrics.BiometricOutcome>;
  enableBiometrics: () => Promise<biometrics.BiometricOutcome>;
  skipBiometrics: () => Promise<void>;
  capability: biometrics.BiometricCapability | null;
  /**
   * Ask the device again what it can do, and answer with what it said.
   *
   * Returns the capability rather than only storing it, because the callers
   * that matter act on it in the same tick they asked — `capability` on this
   * context is a render value and will still be the old one for them.
   */
  refreshCapability: () => Promise<biometrics.BiometricCapability>;

  /** Gateway layer. Route on `primal.state`, not on `status`, for anything
   *  that costs money or touches LinkPay. */
  primal: PrimalState;
  /** Re-ask the gateway what this session may do. Call after a payment lands,
   *  on foreground, and on a pull-to-refresh — it is a single cheap GET. */
  refreshEntitlement: () => Promise<void>;
  /** Retry the SIWE handshake after a network failure. */
  linkPrimal: () => Promise<void>;
}

/**
 * Decide whether the app lock stored on this device belongs to the account
 * that is signing in.
 *
 * The PIN and the biometric preference survive a sign-out (that is the whole
 * point — a returning user should not re-run onboarding), which makes this the
 * check that has to exist alongside them. One device holds one app lock, so
 * without it the next account to sign in on this handset inherits the last
 * one's PIN: locked out of their own money at best, and at worst let into it by
 * a PIN its owner never chose.
 *
 * Returns what the caller should believe about the local lock. A `false`
 * `pinSet` means onboarding, and by then the mismatched credentials are already
 * gone.
 */
async function reconcileAppLock(
  address: string | null,
): Promise<{ pinSet: boolean; biometricsEnabled: boolean }> {
  const [pinSet, biometricsEnabled, remembered] = await Promise.all([
    storage.hasPin(),
    storage.isBiometricsEnabled(),
    storage.getRememberedAccount(),
  ]);

  if (!pinSet) return { pinSet: false, biometricsEnabled: false };

  // A PIN set up before the binding existed. Adopt it rather than making an
  // existing user redo onboarding for an upgrade they did not ask for.
  if (!remembered) {
    if (address) await storage.rememberAccount(address);
    return { pinSet: true, biometricsEnabled };
  }

  // Nothing to compare against — Decane restored a session with no EVM address.
  // Keep the lock: it still has to be entered, and refusing here would strand
  // the owner behind a wipe on the strength of a missing field.
  if (!address) return { pinSet: true, biometricsEnabled };

  if (gatewayAuth.isSameWallet(remembered, address)) {
    return { pinSet: true, biometricsEnabled };
  }

  // A different wallet. The stored lock describes someone else.
  await storage.clearAll();
  return { pinSet: false, biometricsEnabled: false };
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
    biometricsEnabled: false,
    creatingWallet: false,
    returning: false,
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

  /**
   * The wallet the last automatic handshake was started for.
   *
   * Two jobs, and the second is the load-bearing one. It stops the effect below
   * re-running the whole handshake every time `status` moves, and — because it
   * is compared against the address Decane currently reports — it is what makes
   * a WALLET CHANGE visible at all. Sign out of one wallet and into another
   * within a launch and `state.session` is simply replaced; nothing about that
   * new object says the Primal tokens on disk were minted for someone else.
   * `bootstrap(address)` does the actual refusing; this is what gets it asked.
   */
  const syncedFor = useRef<string | null>(null);

  // Launch: let the SDK restore its own session, then decide where the user
  // belongs before the first frame commits to a route.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [session, cap] = await Promise.all([
        decane.restoreSession(),
        biometrics.getCapability(),
      ]);
      if (cancelled) return;

      setCapability(cap);

      if (!session) {
        // No wallet session, but the device may still be set up — that is
        // exactly what a sign-out leaves behind, and it is what tells the entry
        // route to show sign-in rather than the first-run pitch.
        const returning = await storage.hasRememberedAccount();
        if (cancelled) return;
        setState((s) => ({
          ...s,
          status: "signedOut",
          step: "pin",
          session: null,
          biometricsEnabled: false,
          returning,
        }));
        return;
      }

      const lock = await reconcileAppLock(session.addresses.evm ?? null);
      if (cancelled) return;

      setState((s) => ({
        ...s,
        status: lock.pinSet ? "locked" : "onboarding",
        step: lock.pinSet ? "complete" : "pin",
        session,
        biometricsEnabled: lock.biometricsEnabled,
        returning: lock.pinSet,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Ask the device again what it can do.
   *
   * The launch read above is not enough on its own, and the failure it caused
   * is invisible from the inside: enrol a face (Settings on a handset, Features
   * › Face ID on a simulator) while the app is running and the answer captured
   * at launch is stale forever — `available: false` — so the lock screen offers
   * no biometric button no matter what the hardware is now capable of, and the
   * only cure is a relaunch.
   *
   * Two triggers, both cheap (three native calls, no prompt, nothing shown):
   *
   * - **Every return to the foreground.** Enrolling means leaving the app, so
   *   this is the transition that follows every change of the answer.
   * - **Every time the app locks**, because the lock screen is the surface that
   *   acts on it, and it is about to be the thing on screen.
   */
  useEffect(() => {
    let cancelled = false;

    const reread = () => {
      void (async () => {
        const next = await biometrics.getCapability();
        if (!cancelled) setCapability(next);
      })();
    };

    if (state.status === "locked") reread();
    const off = onForeground(reread);

    return () => {
      cancelled = true;
      off();
    };
  }, [state.status]);

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
      // The connected address is passed in so a stored pair belonging to a
      // DIFFERENT wallet is refused rather than restored. Those tokens are
      // still valid — that is the trap — and `me()` would happily confirm them.
      let identity = (await gatewayAuth.bootstrap(walletAddress)).identity;

      if (!identity) {
        // The chain is named here rather than left to `signMessage`'s default,
        // so `SIWE_CHAIN` is the single declaration both sides read. Two
        // constants that happen to agree today are two constants that can
        // drift, and a signature produced on the wrong chain fails verification
        // with the same opaque 400 as a corrupted message.
        await gatewayAuth.signInWithWallet(walletAddress, (message) =>
          decane.signMessage(message, gatewayAuth.SIWE_CHAIN),
        );
        identity = await gatewayAuth.me();
      }

      // Commit the identity the moment authentication is settled, BEFORE asking
      // about entitlement. The two are independent decisions and the contract is
      // explicit that a verified wallet does not mean a paid one — so the
      // reverse has to hold too. Leaving `identity` null until the probe
      // returned meant one failed GET presented a fully authenticated user as
      // nobody: the store subscriber below stopped recognising a forced
      // sign-out (it only fires when there was an identity to lose), and a
      // dropped connection read as "not signed in" rather than "signed in, do
      // not know about the subscription yet".
      const authenticated = identity;
      setPrimal((p) => ({
        ...p,
        // `anonymous` and `session_expired` both assert "not authenticated",
        // and we have just proved otherwise. Drop back to `unknown` — which is
        // the honest reading of "signed in, entitlement not decided yet" —
        // rather than leaving a stale claim on screen if the probe below never
        // lands. Any settled state is left alone; the probe will replace it.
        state:
          p.state === "anonymous" || p.state === "session_expired"
            ? "unknown"
            : p.state,
        identity: authenticated,
        error: null,
      }));

      const snapshot = await entitlement.probeEntitlement();
      setPrimal({
        state: snapshot.state,
        identity: authenticated,
        syncing: false,
        error: null,
      });
    } catch (error) {
      const dead = SessionExpiredError.is(error);
      // A failure that is not a session failure must not cost the caller its
      // record of who is signed in — an entitlement probe that never arrived
      // says nothing about authentication, and signing a paying user out over
      // it is the exact collapse the contract forbids.
      if (!dead) syncedFor.current = null;
      setPrimal((p) => ({
        ...p,
        // A dead session is a routing decision; everything else is a message.
        // Notably NOT a downgrade to `authenticated_unpaid` — a request that
        // never arrived says nothing about whether this user has paid.
        state: dead ? "session_expired" : p.state,
        identity: dead ? null : p.identity,
        syncing: false,
        error: dead ? null : describeGatewayFailure(error),
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
      if (state.status === "signedOut") {
        syncedFor.current = null;
        setPrimal({ ...IDLE_PRIMAL, state: "anonymous" });
      }
      return;
    }

    if (state.status !== "ready" && state.status !== "onboarding") return;

    // A stand-in wallet cannot produce a signature the real gateway would
    // accept, so the gateway layer stays inert rather than failing a handshake
    // it was never going to win — UNLESS the gateway is a stand-in too, in
    // which case the two halves match and the handshake is exactly what should
    // run. That is the whole difference between a credential-less build that
    // stops at the sign-in screen and one that walks the entire flow.
    if (decane.usingMockAuth && !usingPlaceholderGateway) {
      setPrimal({ ...IDLE_PRIMAL, state: "anonymous" });
      return;
    }

    if (primalSync.current) return;
    // Already handled THIS wallet. A different one falls through and re-runs,
    // which is the whole point: the stored pair belongs to the old address and
    // `bootstrap` has to be given the chance to throw it away.
    if (gatewayAuth.isSameWallet(syncedFor.current, address)) return;

    syncedFor.current = address;
    const run = runPrimalSync(address).finally(() => {
      primalSync.current = null;
    });
    primalSync.current = run;
  }, [state.session, state.status, runPrimalSync]);

  /**
   * The wallet went away underneath us.
   *
   * Decane's session and Primal's expire independently, and a Primal pair
   * outliving its wallet is the one direction that is never legitimate: those
   * tokens were minted against a signature from a key this device can no longer
   * produce. Clear them here rather than waiting for a screen to discover it,
   * because until they are cleared they still work — the gateway has no idea
   * the wallet is gone, and every entitled route keeps answering for a wallet
   * the user cannot sign with.
   */
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void)[] = [];

    const drop = () => {
      syncedFor.current = null;
      primalSync.current = null;
      void gatewayAuth.logout();
      setPrimal({ ...IDLE_PRIMAL, state: "session_expired" });
    };

    (async () => {
      const offs = await Promise.all([
        decane.onSdkEvent("disconnected", drop),
        decane.onSdkEvent("session-expired", drop),
      ]);
      if (cancelled) offs.forEach((off) => off());
      else dispose = offs;
    })();

    return () => {
      cancelled = true;
      dispose.forEach((off) => off());
    };
  }, []);

  // The client clears storage when a refresh is refused outright. That can
  // happen mid-request, far from here, so react to the store rather than
  // waiting for the next screen to discover it.
  useEffect(
    () =>
      gatewaySession.subscribe((next) => {
        if (next === null) {
          setPrimal((p) =>
            p.identity
              ? {
                  state: "session_expired",
                  identity: null,
                  syncing: false,
                  error: null,
                }
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
      setPrimal((p) => ({
        ...p,
        state: snapshot.state,
        syncing: false,
        error: null,
      }));
    } catch (error) {
      setPrimal((p) => ({
        ...p,
        state: SessionExpiredError.is(error) ? "session_expired" : p.state,
        identity: SessionExpiredError.is(error) ? null : p.identity,
        syncing: false,
        error: SessionExpiredError.is(error)
          ? null
          : describeGatewayFailure(error),
      }));
    }
  }, []);

  /** Retry the handshake after a failure the user has since fixed. */
  const linkPrimal = useCallback(async () => {
    const address = state.session?.addresses.evm;
    if (!address || (decane.usingMockAuth && !usingPlaceholderGateway)) return;
    // Same gate as the automatic handshake below: signing raises a biometric
    // prompt on the passkey and enclave tiers, and behind the lock screen that
    // is a prompt the user cannot explain. A caller retrying by hand must not
    // reach past a guard the automatic path respects.
    if (state.status !== "ready" && state.status !== "onboarding") return;
    if (primalSync.current) return primalSync.current;
    // Deliberately NOT gated on `syncedFor` the way the automatic effect is.
    // This is a person tapping Try again on a failure they have since fixed;
    // refusing because the same wallet was attempted before would make the
    // button do nothing.
    syncedFor.current = address;
    const run = runPrimalSync(address).finally(() => {
      primalSync.current = null;
    });
    primalSync.current = run;
    return run;
  }, [state.session, state.status, runPrimalSync]);

  /**
   * Keep asking while the answer is "not yet".
   *
   * `payment_pending` and `entitlement_syncing` are both waiting rooms: the
   * money is moving, or the backend has taken the money and not finished
   * propagating entitlement. Neither resolves from anything the app does, so
   * without a re-probe the only ways out are a user tapping recheck on the
   * subscription screen or an app restart — and a user who has just paid,
   * looking at a screen that still says unpaid, pays again.
   *
   * Bounded on purpose. Thirty seconds is far below the gateway's limit (120 a
   * window, observed), and it stops after ten minutes rather than polling for
   * the life of the process: past that, something is wrong that waiting will
   * not fix, and the manual recheck is still there.
   */
  useEffect(() => {
    if (!entitlement.isPending(primal.state)) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    const timer = setInterval(() => {
      attempts += 1;
      if (attempts > MAX_ATTEMPTS) {
        clearInterval(timer);
        return;
      }
      void refreshEntitlement();
    }, 30_000);

    return () => clearInterval(timer);
  }, [primal.state, refreshEntitlement]);

  const adopt = useCallback(async (session: DecaneSession) => {
    if (__DEV__ && !session.accessToken) {
      // Sign-in succeeded but produced no JWT — the backend exchange has
      // nothing to send, and that must not look like a clean success.
      console.warn("[decane] connected but getAccessToken() returned null");
    }

    // A returning user who still has a PIN skips straight past onboarding, and
    // brings their biometric preference with them — it is stored per device, so
    // signing in again is not a reason to re-ask or to quietly forget it.
    //
    // `ready`, not `locked`: they have just proved who they are to the identity
    // provider seconds ago, and asking for the PIN on top of that is the same
    // gate twice. The PIN's job is the NEXT launch, and money-out.
    //
    // Reconciled rather than read straight, because the lock that survived the
    // last sign-out may belong to a different account than the one that just
    // signed in — see `reconcileAppLock`.
    const lock = await reconcileAppLock(session.addresses.evm ?? null);

    setState((s) => ({
      ...s,
      status: lock.pinSet ? "ready" : "onboarding",
      step: lock.pinSet ? "complete" : "pin",
      session,
      pending: null,
      biometricsEnabled: lock.biometricsEnabled,
      creatingWallet: false,
      returning: lock.pinSet,
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

  /**
   * `forget: true` is "switch account" — see the API doc above. Everything
   * except the local app lock is torn down either way.
   */
  const signOut = useCallback(
    async ({ forget = false }: { forget?: boolean } = {}) => {
      // Order matters: revoke the token first so nothing in flight can keep using
      // it, then end the Decane session, then clear local state. Each step is
      // independent — a failure in one must not leave the user half signed out,
      // which is why `decane.signOut` swallows its own errors.
      // Revoke the Primal refresh session before the wallet goes: once Decane is
      // disconnected there is no signer left to prove ownership, and a live
      // refresh token left on the server outlives the sign-out that was meant to
      // end it. `logout` clears local storage whatever the network does.
      await gatewayAuth.logout();
      await entitlement.forgetSubscriptionId();
      // Both gateway modules namespace their persisted money state per account,
      // so nothing here deletes any of it. A sign-out is not evidence that a
      // payout or a purchase can no longer be resumed — and after five wrong PINs
      // (unlock.tsx) it is not even a deliberate act, so a sweep here would
      // release live keys on a guess and let the same user pay twice. What is
      // dropped is the process-wide memory mirror, so a second account signing in
      // during this launch starts clean. Neither call reads the session, so their
      // position relative to `gatewayAuth.logout()` above does not matter.
      clearPayoutState();
      clearVasState();
      await decane.signOut({ forget });

      // The app lock is NOT part of a sign-out. It is a property of this device —
      // a PIN hashed into the keychain and a yes/no about Face ID — and wiping it
      // here is what made a returning user re-run PIN creation and the biometric
      // question every single time, which is onboarding a device that was already
      // onboarded. It goes only when the credentials have stopped describing
      // whoever is holding the phone: a deliberate account switch, or a PIN
      // lockout. A different wallet signing in is caught by `reconcileAppLock`.
      if (forget) await storage.clearAll();
      const returning = forget ? false : await storage.hasRememberedAccount();

      primalSync.current = null;
      // Without this, signing straight back in on the SAME wallet would find the
      // guard still set and never re-run the handshake — the app would sit at
      // `anonymous` holding no tokens.
      syncedFor.current = null;
      setPrimal({ ...IDLE_PRIMAL, state: "anonymous" });
      setState({
        status: "signedOut",
        step: "pin",
        session: null,
        pending: null,
        // The stored preference may well have survived (a plain sign-out keeps
        // it), but there is no session for it to unlock. The next sign-in reads
        // it back off disk through `reconcileAppLock`.
        biometricsEnabled: false,
        creatingWallet: false,
        returning,
      });
    },
    [],
  );

  const createPin = useCallback(
    async (pin: string) => {
      await storage.savePin(pin);
      // Bind it to the wallet that is setting it. Without this the PIN is a
      // free-floating device secret, and the next account to sign in here would
      // inherit it — see `reconcileAppLock`, which is the reader of this write.
      const address = state.session?.addresses.evm;
      if (address) await storage.rememberAccount(address);
      setState((s) => ({
        ...s,
        status: "onboarding",
        step: "passkey",
        returning: true,
      }));
    },
    [state.session],
  );

  /**
   * Only from `ready`, and that guard is the whole of it.
   *
   * Every other status either has no lock to close or must not be interrupted:
   * `signedOut` has nothing behind it, `locked` is already there, and
   * `onboarding` is the window in which the PIN is still being chosen — locking
   * a user who has not set one yet would strand them at a keypad that can never
   * accept anything, with no way out but reinstalling. `ready` is the one state
   * that implies a PIN exists, because it is only ever reached through one
   * being set or verified.
   */
  const lock = useCallback(() => {
    setState((s) => (s.status === "ready" ? { ...s, status: "locked" } : s));
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
    const outcome = await biometrics.authenticate("Unlock KashPlus");
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

  const refreshCapability = useCallback(async () => {
    const next = await biometrics.getCapability();
    setCapability(next);
    return next;
  }, []);

  const enableBiometrics = useCallback(async () => {
    const outcome = await biometrics.authenticate("Enable biometric unlock");
    if (outcome.ok) {
      await storage.setBiometricsEnabled(true);
      setState((s) => ({
        ...s,
        status: "ready",
        step: "complete",
        biometricsEnabled: true,
      }));
    }
    return outcome;
  }, []);

  const skipBiometrics = useCallback(async () => {
    await storage.setBiometricsEnabled(false);
    setState((s) => ({
      ...s,
      status: "ready",
      step: "complete",
      biometricsEnabled: false,
    }));
  }, []);

  const value = useMemo<AuthApi>(
    () => ({
      ...state,
      addresses: state.session?.addresses ?? null,
      capability,
      refreshCapability,
      signIn,
      startEmailSignIn,
      verifyEmailCode,
      signOut,
      createPin,
      lock,
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
      refreshCapability,
      signIn,
      startEmailSignIn,
      verifyEmailCode,
      signOut,
      createPin,
      lock,
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
