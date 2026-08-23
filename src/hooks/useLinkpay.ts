/**
 * LinkPay screen state: the account, the money in it, and the payout being
 * confirmed.
 *
 * Everything here reads through `src/lib/gateway/linkpay.ts`. There is no fetch
 * in this file and no second opinion about entitlement — a 403 from the gateway
 * is the only thing that decides that, and it surfaces as a phase the route can
 * route on rather than as an error the user is asked to retry.
 *
 * The distinction the whole fiat surface turns on, in one place:
 *
 * - **not entitled** (403) → the paywall. The user is signed in perfectly well.
 * - **paying, or just paid** → a WAIT, never the paywall. See `activating`.
 * - **entitled, no account** (404 / an empty account body) → the KYC CTA.
 * - **entitled, ACTIVE account** → the money screen.
 *
 * They fail differently, they recover differently, and collapsing any two of
 * them puts a paying user in front of a sign-in screen.
 */

import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { appIsActive, onForeground } from "@/lib/appActive";
import { useAuth } from "@/lib/auth/AuthContext";
import { isEntitlementRefusal, isPending } from "@/lib/gateway/entitlement";
import {
  describeLinkpayFailure,
  getAccount,
  getBalance,
  isAccountUsable,
  isBlankAccount,
  isProvisioning,
  listActivity,
  type ActivityEntry,
  type LinkpayAccount,
} from "@/lib/gateway/linkpay";
import {
  AbortedError,
  SessionExpiredError,
  isEntitled,
  type Balance,
  type Money,
  type PrimalAppState,
} from "@/lib/gateway/types";

/* -------------------------------------------------------------- account phase */

/**
 * What the fiat surface should be showing.
 *
 * `unknown_status` is the deliberate escape hatch: a gateway that ships a new
 * account status tomorrow lands here and gets an honest panel, instead of being
 * silently read as "no account" and offered a second KYC run.
 */
export type AccountPhase =
  | "loading"
  | "signed_out"
  | "unentitled"
  /**
   * Money is moving, or has moved and not propagated yet. A WAIT, and never
   * the paywall — see `phaseForAppState`.
   */
  | "activating"
  | "no_account"
  | "provisioning"
  | "provision_failed"
  | "disabled"
  | "unknown_status"
  | "ready"
  | "error";

function phaseForAccount(account: LinkpayAccount | null): AccountPhase {
  if (isBlankAccount(account)) return "no_account";
  const status = account!.status;
  if (isAccountUsable(status)) return "ready";
  if (isProvisioning(status)) return "provisioning";
  if (status === "PROVISION_FAILED") return "provision_failed";
  if (status === "DISABLED") return "disabled";
  return "unknown_status";
}

/**
 * How long an `unknown` that is not syncing and has left no error is given to
 * become something, before the screen says so.
 *
 * The handshake waits for the wallet to be unlocked, and a screen reached
 * before it starts — a deep link, a relaunch straight into /fiat — sits in an
 * `unknown` that nothing on this side can advance. Generous enough that a
 * handshake about to start is never interrupted by a wrong answer.
 */
const HANDSHAKE_GRACE_MS = 6_000;

/** Written for a person, because it is the only thing they will be shown. */
const HANDSHAKE_STALLED =
  "KashPlus has not opened a session on this device yet. Try again — and if it keeps saying this, sign out and back in.";

/**
 * How often a provisioning account is re-asked about while someone is watching
 * it. KycScreen prints this cadence, so the two move together.
 */
const PROVISION_POLL_MS = 10_000;

/**
 * How long the automatic re-asking runs before it stops.
 *
 * A poll with no terminal condition is a poll that outlives its reason: an
 * account wedged in PENDING_KYC would otherwise wake the radio every ten
 * seconds for as long as the app is installed, and the tick that finds it
 * unchanged on minute two is the same tick that finds it unchanged on hour six.
 * The bank's own answer is "a minute or two", so ten minutes is far past the
 * point where waiting is the thing that helps — after it, the screen says so
 * and the manual re-check is the way on.
 */
const PROVISION_POLL_WINDOW_MS = 10 * 60_000;

/**
 * How often an activating entitlement is re-probed from the screen the user is
 * actually looking at.
 *
 * AuthContext already re-probes every 30 seconds while `isPending`, which is
 * the right cadence for the app as a whole and much too slow for someone
 * staring at the screen they just paid to unlock. This is the faster ask, and
 * it exists only while a screen is in front of a person — the entitled surface
 * cannot be reached at all until it resolves, so the wait IS the screen.
 */
const ACTIVATION_PROBE_MS = 6_000;

/**
 * How long that faster asking runs before it stands down.
 *
 * Two minutes is well past propagation, and AuthContext's slower timer keeps
 * going for ten. After it, the screen says the asking has stopped and hands
 * over the manual control rather than claiming a cadence it is not keeping —
 * the same rule the provisioning poll follows.
 */
const ACTIVATION_PROBE_WINDOW_MS = 2 * 60_000;

/**
 * Which kind of wait `activating` is, so a screen can say the true one.
 *
 * - `payment` — a subscription exists and its transfer has not landed. The
 *   money has not left yet, so "we have your payment" would be a lie.
 * - `propagation` — the subscription reads ACTIVE and entitled routes still
 *   403. The money HAS gone; the backend is catching up.
 */
export type ActivationWait = "payment" | "propagation";

/**
 * The phase implied by the app-level state alone, before LinkPay is asked
 * anything — or `null` when the gateway is the one that has to answer.
 *
 * `unknown` is "the first probe has not landed yet", which is loading, not
 * anonymous: routing a paying user to sign-in for a quarter of a second is
 * still routing a paying user to sign-in. But an `unknown` that has STOPPED
 * syncing and left an error behind is a dead end, not a loading state — an
 * offline launch would otherwise spin a skeleton forever.
 *
 * `stalled` is the third case, and the one that has no error to show: an
 * `unknown` that is not syncing and never failed has not STARTED. Nothing here
 * can make it start, so after the grace window it becomes an honest error with
 * a retry rather than a skeleton that shimmers until the app is killed.
 */
function phaseForAppState(
  primal: {
    state: PrimalAppState;
    syncing: boolean;
    error: string | null;
  },
  stalled: boolean,
): { phase: AccountPhase; error: string | null } | null {
  if (primal.state === "unknown") {
    if (primal.syncing) return { phase: "loading", error: null };
    if (primal.error) return { phase: "error", error: primal.error };
    return stalled
      ? { phase: "error", error: HANDSHAKE_STALLED }
      : { phase: "loading", error: null };
  }
  if (primal.state === "anonymous" || primal.state === "session_expired") {
    return { phase: "signed_out", error: null };
  }
  // A payment mid-flight and a payment the backend has taken but not finished
  // propagating are both a WAIT, and this line is the whole reason.
  //
  // `isEntitled` is true for `active`/`cancel_at_period_end` and nothing else,
  // so before this existed both `payment_pending` and `entitlement_syncing`
  // fell through to `unentitled` — and the fiat space acts on that phase by
  // pushing to /subscribe. A member who had just paid USD 1,000 was asked to
  // pay again in the seconds while activation propagated, on a paywall whose
  // only exit is "Sign out" (`subscribe.tsx` bars every entitlement-less
  // state). `types.ts` says of `entitlement_syncing`: "wait and re-probe
  // rather than asking for money twice". This is that, and `bills.tsx` reads
  // the same two states the same way.
  if (isPending(primal.state)) return { phase: "activating", error: null };
  return isEntitled(primal.state) ? null : { phase: "unentitled", error: null };
}

/** The wait behind an `activating` phase, or `null` when it is not one. */
function activationWaitFor(state: PrimalAppState): ActivationWait | null {
  if (state === "payment_pending") return "payment";
  if (state === "entitlement_syncing") return "propagation";
  return null;
}

/* ------------------------------------------------------------------ account */

export interface LinkpayAccountState {
  phase: AccountPhase;
  account: LinkpayAccount | null;
  /** Set only on `phase === "error"`. Already written for a person. */
  error: string | null;
  /**
   * Which wait `phase === "activating"` is, and `null` for every other phase.
   *
   * Carried because the two read very differently to the person waiting: one
   * is money that has not moved yet, the other is money that has. A screen
   * that says the wrong one is either asking for a payment already made or
   * promising a payment that was never sent.
   */
  activation: ActivationWait | null;
  /**
   * A re-read is outstanding.
   *
   * True from the instant `reload` is CALLED until the account answer lands —
   * not merely while the request is on the wire — because a caller that holds a
   * control until the account has been re-read (KycScreen holds both of the
   * ones that can drop an idempotency key) must not be handed a window in which
   * the answer is pending and nothing says so.
   */
  refreshing: boolean;
  /**
   * Bumped once per load attempt. Anything that should re-fetch alongside the
   * account watches THIS rather than `refreshing`, which flips twice a load and
   * would double every request hung off it.
   */
  version: number;
  /**
   * The hook is still re-asking on its own — about a provisioning account, or
   * about an entitlement that is still being switched on.
   *
   * False once the phase settles into anything else, and false once that
   * phase's window is spent — at which point a screen that promised "checking
   * every ten seconds" is telling the user something that has stopped being
   * true, and owes them the manual control instead.
   *
   * It deliberately does NOT track focus or the foreground: those pause the
   * asking for as long as nobody is looking, and a screen only reads this while
   * it is the thing being looked at.
   */
  watching: boolean;
  reload: () => void;
}

/**
 * The user's LinkPay account, and what to show because of it.
 *
 * Re-reads on focus so a screen returning from KYC shows the account that was
 * just provisioned, and re-asks on a slow cadence while provisioning is
 * mid-flight — that state resolves on the provider's clock, not on a tap. The
 * re-asking is gated on focus and on the foreground and is bounded in time; see
 * the loop near the bottom for why each of those is not optional.
 */
export function useLinkpayAccount(): LinkpayAccountState {
  const { primal, linkPrimal, status, refreshEntitlement } = useAuth();

  const [phase, setPhase] = useState<AccountPhase>("loading");
  const [account, setAccount] = useState<LinkpayAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  /**
   * Whether the handshake is something this hook may START.
   *
   * Signing the SIWE challenge raises a biometric prompt on the passkey and
   * enclave tiers, which is why AuthContext's own handshake refuses to run
   * outside `ready`/`onboarding`: behind the lock screen it would be a prompt
   * the user cannot explain. Everything this hook can DO obeys the same rule —
   * a retry control that reached past that guard would raise exactly the prompt
   * the automatic path declined to raise.
   *
   * It is not the same question as "is this wait going anywhere", and conflating
   * the two is what put a permanent skeleton over the money surface: see below.
   */
  const canHandshake = status === "ready" || status === "onboarding";

  /**
   * Whether another screen owns the gate this `unknown` is waiting behind.
   *
   * Only `locked` does. LockGate redirects every route but the auth ones to
   * /unlock, so a locked launch is waiting for a PIN that is one screen away —
   * calling that stalled would put an error over a wait that is about to end.
   * `signedOut` settles itself: AuthContext turns it into `anonymous`, which
   * this hook reads as signed out long before the grace window is up.
   *
   * `loading` is emphatically NOT such a gate, and excluding it is what made
   * HANDSHAKE_STALLED unreachable from the one failure it was written for. The
   * launch effect that owns `loading` has no try/catch and no `.catch()`, and
   * everything it awaits is called bare (SecureStore, LocalAuthentication), so
   * one rejection — a keychain that will not decrypt after a device restore is
   * the ordinary way in — pins the status there for the rest of the launch with
   * nothing left in the app that could advance it. Nothing here can sign in that
   * state either, and nothing here claims it can; what it can do is stop
   * shimmering a skeleton over the user's money and say so.
   */
  const gatedElsewhere = status === "locked";

  // An `unknown` with nothing in flight and nothing to report. It is a real
  // state — the handshake deliberately waits for the wallet to unlock — and it
  // is indistinguishable from "about to start", so it is given a window rather
  // than being called dead on sight. Re-armed on every retry, so tapping "Try
  // again" visibly re-enters the waiting state instead of doing nothing.
  const idleHandshake =
    !gatedElsewhere &&
    primal.state === "unknown" &&
    !primal.syncing &&
    primal.error === null;
  const [handshakeStalled, setHandshakeStalled] = useState(false);
  useEffect(() => {
    setHandshakeStalled(false);
    if (!idleHandshake) return;
    const timer = setTimeout(() => setHandshakeStalled(true), HANDSHAKE_GRACE_MS);
    return () => clearTimeout(timer);
    // `status` is a dependency even where it does not change `idleHandshake`:
    // each transition is a new gate and deserves a whole window, so a launch
    // that only reaches `ready` at second five still gets the full grace period
    // for the handshake it can finally start, rather than the remainder of the
    // window the restore was already burning through.
  }, [idleHandshake, status, nonce]);

  // Read as two primitives, not as the object: a fresh object every render
  // would make the load effect below fire on every render.
  const gate = phaseForAppState(primal, handshakeStalled);
  const gatePhase = gate?.phase ?? null;
  const gateError = gate?.error ?? null;

  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Retrying from a screen has to reach whichever layer actually failed: a
  // handshake that never completed is fixed by `linkPrimal`, not by asking
  // LinkPay a question the app has no session to ask with. `canHandshake` is
  // carried into it — and stays here rather than moving up into the stall
  // detection above — so a tap can only start a handshake the automatic path
  // would also have started, and never raises a signing prompt from behind the
  // lock screen or a launch that has not decided anything yet. A retry from
  // such a status re-enters the wait and reports again if it is still stuck,
  // which is honest; signing there would not be.
  const needsHandshake = primal.state === "unknown" && canHandshake;
  /**
   * The entitlement itself is what has not landed. LinkPay cannot be asked
   * about it — every route there is behind the guard that is still saying no —
   * so the retry has to be the entitlement probe, exactly as `bills.tsx` does
   * for its `waiting` gate.
   */
  const awaitingEntitlement = isPending(primal.state);
  const reload = useCallback(() => {
    if (needsHandshake) void linkPrimal();
    else if (awaitingEntitlement) void refreshEntitlement();
    // Flagged here rather than in the effect below, so "a re-read is
    // outstanding" is true from the moment it is asked for. The effect runs a
    // commit later; a caller that gates a control on `refreshing` — the two
    // KycScreen controls that can drop an idempotency key — would otherwise get
    // a window in which the question has been asked and the screen says
    // nothing is pending.
    setRefreshing(true);
    setNonce((n) => n + 1);
  }, [needsHandshake, awaitingEntitlement, linkPrimal, refreshEntitlement]);

  useEffect(() => {
    // The gateway session already answers this — do not spend a request to be
    // told the same thing, and do not clear an account we already have.
    if (gatePhase !== null) {
      setPhase(gatePhase);
      setError(gateError);
      setRefreshing(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    // Only the first load blanks the screen; a refresh keeps the last figures
    // visible underneath it.
    setRefreshing(true);

    (async () => {
      try {
        const next = await getAccount({ signal: controller.signal });
        if (cancelled || !live.current) return;
        setAccount(next);
        setError(null);
        setPhase(phaseForAccount(next));
      } catch (err) {
        if (cancelled || !live.current || AbortedError.is(err)) return;
        if (SessionExpiredError.is(err)) {
          // AuthContext is subscribed to the same clearance and will move the
          // app state; this screen only has to stop pretending it has data.
          setPhase("signed_out");
          return;
        }
        // Any 403 from `/v1/linkpay/*`, not only one that spells out
        // SUBSCRIPTION: the guard runs before the lookup, so there is nothing
        // else on this route for a 403 to mean, and the paywall is a phase the
        // route can act on where an error string is a dead end.
        if (isEntitlementRefusal(err)) {
          setPhase("unentitled");
          return;
        }
        setError(describeLinkpayFailure(err));
        setPhase("error");
      } finally {
        if (!cancelled && live.current) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [gatePhase, gateError, nonce]);

  /* ------------------------------------------------- provisioning re-asking */

  // Whether an answer is already on its way. Mirrored into a ref rather than
  // read as state by the loop below, because `refreshing` flips twice per load
  // and a loop that listed it as a dependency would restart its own timer on
  // every flip — the cadence would come out of whatever the network was doing
  // rather than out of PROVISION_POLL_MS.
  const rereadPending = useRef(false);
  useEffect(() => {
    rereadPending.current = refreshing;
  }, [refreshing]);

  // The window is anchored in a ref to the moment provisioning STARTED, so
  // leaving the screen and coming back resumes the same window instead of
  // being handed a fresh ten minutes on every visit.
  const pollDeadline = useRef<number | null>(null);
  const [pollSpent, setPollSpent] = useState(false);
  useEffect(() => {
    if (phase !== "provisioning") {
      pollDeadline.current = null;
      setPollSpent(false);
      return;
    }
    pollDeadline.current ??= Date.now() + PROVISION_POLL_WINDOW_MS;
  }, [phase]);

  const focused = useIsFocused();

  /**
   * Provisioning finishes on the provider's clock, so the account is re-asked
   * about rather than left to a tap the user has no reason to think would help.
   *
   * Everything about WHEN is a gate, and each gate is here for its own reason:
   *
   * - Not provisioning → there is nothing resolving, so there is no timer.
   * - Not focused → this hook is mounted on three screens, two of them behind
   *   tabs. Polling from a screen the user navigated away from spends their
   *   battery on a panel nobody can see.
   * - Backgrounded → the tick is SKIPPED, not stopped. iOS pauses JS timers
   *   here and Android does not, so an ungated loop is an Android-only radio
   *   drain; `onForeground` then re-asks the moment they come back rather than
   *   making them wait out the remainder of an interval.
   * - A re-read already outstanding → asking again just aborts the answer that
   *   was on its way, and a request slower than the cadence would never land.
   * - Window spent → see PROVISION_POLL_WINDOW_MS.
   *
   * One self-scheduling timeout, held in a closure variable, so there is exactly
   * one timer per run of the effect: React's cleanup cancels it before any
   * re-render can start a second, and unmounting cancels it outright.
   */
  useEffect(() => {
    if (phase !== "provisioning" || !focused || pollSpent) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      timer = null;
      if (cancelled) return;

      const deadline = pollDeadline.current;
      if (deadline !== null && Date.now() >= deadline) {
        setPollSpent(true);
        return;
      }

      if (appIsActive() && !rereadPending.current) reload();
      timer = setTimeout(tick, PROVISION_POLL_MS);
    };

    timer = setTimeout(tick, PROVISION_POLL_MS);

    const off = onForeground(() => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      tick();
    });

    return () => {
      cancelled = true;
      off();
      if (timer) clearTimeout(timer);
    };
  }, [phase, focused, pollSpent, reload]);

  /* --------------------------------------------------- activation re-asking */

  const activating = phase === "activating";

  // Anchored to the moment the wait STARTED, in a ref, so leaving the screen
  // and coming back resumes the same window rather than being handed a fresh
  // two minutes on every visit.
  const activationDeadline = useRef<number | null>(null);
  const [activationSpent, setActivationSpent] = useState(false);
  useEffect(() => {
    if (!activating) {
      activationDeadline.current = null;
      setActivationSpent(false);
      return;
    }
    activationDeadline.current ??= Date.now() + ACTIVATION_PROBE_WINDOW_MS;
  }, [activating]);

  // A probe already in the air. Mirrored into a ref for the same reason
  // `rereadPending` is: a loop that listed it as a dependency would restart its
  // own timer every time the flag flipped.
  const probePending = useRef(false);
  useEffect(() => {
    probePending.current = primal.syncing;
  }, [primal.syncing]);

  /**
   * Re-probe an entitlement that is still being switched on.
   *
   * The gates are the provisioning loop's gates, for the same reasons: not
   * focused is a screen nobody can see, backgrounded skips the tick rather
   * than killing the loop, a probe already outstanding is not asked twice, and
   * the window is bounded so `watching` never claims a cadence that has
   * stopped.
   *
   * The first ask is immediate rather than one interval in. AuthContext's own
   * re-probe is on a 30-second timer, and a member who has just paid should
   * not watch half a minute of nothing happening before anything is asked on
   * their behalf.
   */
  useEffect(() => {
    if (!activating || !focused || activationSpent) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ask = () => {
      if (appIsActive() && !probePending.current) void refreshEntitlement();
    };

    const tick = () => {
      timer = null;
      if (cancelled) return;

      const deadline = activationDeadline.current;
      if (deadline !== null && Date.now() >= deadline) {
        setActivationSpent(true);
        return;
      }

      ask();
      timer = setTimeout(tick, ACTIVATION_PROBE_MS);
    };

    ask();
    timer = setTimeout(tick, ACTIVATION_PROBE_MS);

    const off = onForeground(() => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      tick();
    });

    return () => {
      cancelled = true;
      off();
      if (timer) clearTimeout(timer);
    };
  }, [activating, focused, activationSpent, refreshEntitlement]);

  // Coming back from KYC (or from the background) should show what changed
  // while the screen was away. The first focus is skipped: the effect above has
  // already fired for it, and two account reads on mount is one too many.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reload();
    }, [reload]),
  );

  return {
    phase,
    account,
    error,
    activation: activating ? activationWaitFor(primal.state) : null,
    refreshing,
    version: nonce,
    watching:
      (phase === "provisioning" && !pollSpent) || (activating && !activationSpent),
    reload,
  };
}

/* ----------------------------------------------------------------- overview */

/** Said in place of the figure, in the same voice the em dash is drawn in. */
const UNREADABLE_BALANCE =
  "KashPlus could not read the balance the gateway sent, so it will not show you a figure it cannot vouch for.";

export interface FiatBalanceState extends LinkpayAccountState {
  balance: Balance | null;
  /**
   * The balance failed, or arrived with no figure worth stating, while the
   * account itself is fine — the screen says so in place. Set together with a
   * `balance` that has no `available`, so "unreadable" is never mistaken for
   * "still loading".
   */
  balanceError: string | null;
}

export interface FiatOverview extends FiatBalanceState {
  activity: ActivityEntry[];
  activityLoading: boolean;
  /** Feed failed on its own. The balance above it is still true. */
  activityError: string | null;
}

/**
 * The account and the one figure on it — no statement feed.
 *
 * Split out of `useFiatOverview` for the home screen, which shows the balance
 * and nothing else: pulling twelve statement rows to render none of them is a
 * request spent on the launch path for nothing.
 */
export function useFiatBalance(): FiatBalanceState {
  const accountState = useLinkpayAccount();
  const usable = accountState.phase === "ready";

  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const accountId = accountState.account?.id ?? null;

  useEffect(() => {
    if (!usable) return;

    const controller = new AbortController();
    let cancelled = false;

    void getBalance({ signal: controller.signal })
      .then((next) => {
        if (cancelled) return;
        setBalance(next);
        // A 200 is not the same as a figure. `readMoney` returns undefined
        // rather than guess at an amount it cannot trust — an empty body, a key
        // it does not probe, a decimal where minor units were promised — and a
        // resolved call with no `available` is that refusal arriving. It is a
        // stated failure, not a pending one: left as `null` here the screen has
        // no way to tell it from a request still in the air, and shimmers a
        // skeleton over the user's money for as long as they look at it.
        setBalanceError(next.available ? null : UNREADABLE_BALANCE);
      })
      .catch((err) => {
        if (cancelled || AbortedError.is(err) || SessionExpiredError.is(err)) return;
        setBalanceError(describeLinkpayFailure(err));
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `version` ticks once per account load, which is the one signal that
    // covers focus, provisioning polls and an explicit retry alike.
  }, [usable, accountId, accountState.version]);

  return { ...accountState, balance, balanceError };
}

/**
 * Everything the fiat space puts on screen.
 *
 * Balance and activity are fetched and failed independently on purpose: a
 * statement feed that 502s is not a reason to hide a balance the gateway just
 * confirmed, and one combined error state would do exactly that.
 */
export function useFiatOverview(): FiatOverview {
  const balanceState = useFiatBalance();
  const usable = balanceState.phase === "ready";

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const accountId = balanceState.account?.id ?? null;

  useEffect(() => {
    if (!usable) {
      setActivityLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setActivityLoading(true);

    void listActivity({ take: 12 }, { signal: controller.signal })
      .then((entries) => {
        if (cancelled) return;
        setActivity(entries);
        setActivityError(null);
      })
      .catch((err) => {
        if (cancelled || AbortedError.is(err) || SessionExpiredError.is(err)) return;
        setActivityError(describeLinkpayFailure(err));
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [usable, accountId, balanceState.version]);

  return { ...balanceState, activity, activityLoading, activityError };
}

/* ------------------------------------------------------------- payout draft */

/**
 * The payout being set up, between the screen that resolves it and the screen
 * that confirms it.
 *
 * In memory only, and never written to disk: it holds a named human being's
 * bank account number, which has no business surviving the flow that needed it.
 * The confirm screen's own record of an *initiated* payout is the persisted
 * one, and that deliberately keeps only the last four digits.
 */
export interface PayoutDraft {
  bankUuid: string;
  bankName: string;
  /** Full NUBAN — required to initiate. Never rendered in full after this. */
  accountNumber: string;
  /** What the bank returned. The user has seen and accepted this name. */
  accountName: string;
  amount: Money;
  narration?: string;
  /** Epoch ms the name enquiry came back, so the confirm screen can date it. */
  resolvedAt: number;
}

let draft: PayoutDraft | null = null;

export function setPayoutDraft(next: PayoutDraft): void {
  draft = next;
}

export function getPayoutDraft(): PayoutDraft | null {
  return draft;
}

export function clearPayoutDraft(): void {
  draft = null;
}
