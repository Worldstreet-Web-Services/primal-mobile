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
 * - **entitled, no account** (404 / an empty account body) → the KYC CTA.
 * - **entitled, ACTIVE account** → the money screen.
 *
 * They fail differently, they recover differently, and collapsing any two of
 * them puts a paying user in front of a sign-in screen.
 */

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
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
  isEntitlementError,
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
 * The phase implied by the app-level state alone, before LinkPay is asked
 * anything — or `null` when the gateway is the one that has to answer.
 *
 * `unknown` is "the first probe has not landed yet", which is loading, not
 * anonymous: routing a paying user to sign-in for a quarter of a second is
 * still routing a paying user to sign-in. But an `unknown` that has STOPPED
 * syncing and left an error behind is a dead end, not a loading state — an
 * offline launch would otherwise spin a skeleton forever.
 */
function phaseForAppState(primal: {
  state: PrimalAppState;
  syncing: boolean;
  error: string | null;
}): { phase: AccountPhase; error: string | null } | null {
  if (primal.state === "unknown") {
    return primal.syncing || !primal.error
      ? { phase: "loading", error: null }
      : { phase: "error", error: primal.error };
  }
  if (primal.state === "anonymous" || primal.state === "session_expired") {
    return { phase: "signed_out", error: null };
  }
  return isEntitled(primal.state) ? null : { phase: "unentitled", error: null };
}

/* ------------------------------------------------------------------ account */

export interface LinkpayAccountState {
  phase: AccountPhase;
  account: LinkpayAccount | null;
  /** Set only on `phase === "error"`. Already written for a person. */
  error: string | null;
  /** A reload is in flight over content that is already on screen. */
  refreshing: boolean;
  /**
   * Bumped once per load attempt. Anything that should re-fetch alongside the
   * account watches THIS rather than `refreshing`, which flips twice a load and
   * would double every request hung off it.
   */
  version: number;
  reload: () => void;
}

/**
 * The user's LinkPay account, and what to show because of it.
 *
 * Re-reads on focus so a screen returning from KYC shows the account that was
 * just provisioned, and polls itself while provisioning is mid-flight — that
 * state resolves on the provider's clock, not on a tap.
 */
export function useLinkpayAccount(): LinkpayAccountState {
  const { primal, linkPrimal } = useAuth();
  // Read as two primitives, not as the object: a fresh object every render
  // would make the load effect below fire on every render.
  const gate = phaseForAppState(primal);
  const gatePhase = gate?.phase ?? null;
  const gateError = gate?.error ?? null;

  const [phase, setPhase] = useState<AccountPhase>("loading");
  const [account, setAccount] = useState<LinkpayAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);

  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Retrying from a screen has to reach whichever layer actually failed: a
  // handshake that never completed is fixed by `linkPrimal`, not by asking
  // LinkPay a question the app has no session to ask with.
  const needsHandshake = primal.state === "unknown";
  const reload = useCallback(() => {
    if (needsHandshake) void linkPrimal();
    setNonce((n) => n + 1);
  }, [needsHandshake, linkPrimal]);

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
        if (isEntitlementError(err)) {
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

  // Provisioning finishes on the provider's clock. Re-ask on a slow cadence
  // rather than leaving the user to guess whether tapping again would help.
  useEffect(() => {
    if (phase !== "provisioning") return;
    const timer = setInterval(reload, 10_000);
    return () => clearInterval(timer);
  }, [phase, reload]);

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

  return { phase, account, error, refreshing, version: nonce, reload };
}

/* ----------------------------------------------------------------- overview */

export interface FiatOverview extends LinkpayAccountState {
  balance: Balance | null;
  /** Balance failed but the account did not — the screen says so in place. */
  balanceError: string | null;
  activity: ActivityEntry[];
  activityLoading: boolean;
  /** Feed failed on its own. The balance above it is still true. */
  activityError: string | null;
}

/**
 * Everything the fiat space puts on screen.
 *
 * Balance and activity are fetched and failed independently on purpose: a
 * statement feed that 502s is not a reason to hide a balance the gateway just
 * confirmed, and one combined error state would do exactly that.
 */
export function useFiatOverview(): FiatOverview {
  const accountState = useLinkpayAccount();
  const usable = accountState.phase === "ready";

  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const accountId = accountState.account?.id ?? null;

  useEffect(() => {
    if (!usable) {
      setActivityLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setActivityLoading(true);

    const guard = (err: unknown): string | null => {
      if (cancelled || AbortedError.is(err) || SessionExpiredError.is(err)) return null;
      return describeLinkpayFailure(err);
    };

    void getBalance({ signal: controller.signal })
      .then((next) => {
        if (cancelled) return;
        setBalance(next);
        setBalanceError(null);
      })
      .catch((err) => {
        const message = guard(err);
        if (message) setBalanceError(message);
      });

    void listActivity({ take: 12 }, { signal: controller.signal })
      .then((entries) => {
        if (cancelled) return;
        setActivity(entries);
        setActivityError(null);
      })
      .catch((err) => {
        const message = guard(err);
        if (message) setActivityError(message);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `version` ticks once per account load, which is the one signal that
    // covers focus, provisioning polls and an explicit retry alike.
  }, [usable, accountId, accountState.version]);

  return {
    ...accountState,
    balance,
    balanceError,
    activity,
    activityLoading,
    activityError,
  };
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
