import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  BackChevron,
  Body,
  Display,
  GhostButton,
  Keypad,
  Label,
  MetallicButton,
  Mono,
  PinDots,
  PulseDot,
  Screen,
  SectionRule,
  Shine,
  Spinner,
} from "../components/ui";
import * as storage from "../lib/auth/storage";
import { clearPayoutDraft, getPayoutDraft, type PayoutDraft } from "../hooks/useLinkpay";
import {
  describeLinkpayFailure,
  findPendingWithdrawal,
  getBalance,
  initiateWithdrawal,
  lastFour,
  loadPendingWithdrawal,
  maskAccount,
  planWithdrawal,
  quoteWithdrawal,
  reconcilePendingWithdrawal,
  retireWithdrawal,
  savePendingWithdrawal,
  subscribeToWithdrawal,
  trackWithdrawal,
  trackedWithdrawal,
  withdrawalFingerprint,
  withdrawalStatusLabel,
  type PendingOutcome,
  type PendingWithdrawal,
  type WithdrawalWatchEvent,
} from "../lib/gateway/linkpay";
import { formatMoney, toBigInt } from "../lib/gateway/money";
import {
  SessionExpiredError,
  isEntitlementError,
  isTerminalTransfer,
  type Money,
  type Withdrawal,
  type WithdrawalQuote,
} from "../lib/gateway/types";
import { C, F } from "../theme/tokens";

/**
 * Design 4e, rewired: the last look before naira leaves.
 *
 * The screen is built around four facts it must not get wrong.
 *
 * 1. **The name is the proof.** It came back from the bank on the previous
 *    screen and the user accepted it there; it is restated here because a
 *    transfer cannot be recalled.
 * 2. **The fee is charged ON TOP.** The gateway quotes `fee` and `totalDebit`
 *    separately, and the figure that leaves the balance is the total — so the
 *    total is the one set in the heavier type, not the amount.
 * 3. **One payout, one key.** The key is reserved when the PIN is accepted and
 *    reused by every retry. A timeout does not mint a second one; it asks the
 *    gateway what it already has. Where the key comes from is the whole of it:
 *    a payout already recorded on disk uses THAT record's key, because that is
 *    the key the gateway may be holding; only a payout with no record derives a
 *    slot, and it derives one per attempt, so a different payout never inherits
 *    a key and a deliberately repeated one is not answered with the last one's
 *    transfer.
 * 4. **The payout outlives this screen.** The poll that decides when the key
 *    may be dropped lives in `linkpay.ts`, not here — the screen invites the
 *    user to leave, and a transfer that settles after they do still has to
 *    release its key. This screen subscribes while it is mounted and never
 *    stops the poll on its way out.
 *
 * The corollary of 3 and 4: a record left over from an EARLIER payout is never
 * narrated as this one. It is resolved against the gateway first, and only a
 * record that describes the draft in front of the user is resumed as it.
 */

const PIN_LENGTH = 4;

type Stage =
  | "loading"
  | "empty"
  | "ready"
  | "submitting"
  | "watching"
  | "settled"
  | "failed"
  | "error"
  /** An earlier payout is still open and has to be resolved before this one. */
  | "prior";

function Check({ size = 18, color = C.brandSoft }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Row({
  label,
  value,
  note,
  strong,
  last,
}: {
  label: string;
  value: string;
  /** The quiet half of the figure — where the number came from. */
  note?: string;
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View>
        <Mono size={9} color={C.dim} style={{ letterSpacing: 1.4 }}>
          {label}
        </Mono>
        {note ? (
          <Mono size={10} color={C.dim} style={{ marginTop: 4 }}>
            {note}
          </Mono>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: strong ? F.monoSemibold : F.mono,
          fontSize: strong ? 14 : 12.5,
          color: strong ? C.text : C.silver,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Head({ title, sub, onBack }: { title: string; sub: string; onBack?: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingTop: 10,
        paddingHorizontal: 22,
      }}
    >
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
        <BackChevron />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Display size={20}>{title}</Display>
        <Mono size={9.5} color={C.dim} style={{ marginTop: 3, letterSpacing: 1.4 }}>
          {sub}
        </Mono>
      </View>
    </View>
  );
}

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * `a > b`, and `false` for anything it cannot read.
 *
 * `toBigInt` throws on a wire value that is not an integer string, and a screen
 * that is one malformed field away from a red box mid-transfer is worse than a
 * screen that declines to make the comparison. The gateway refuses an
 * overdrawn payout on its own; this check is a courtesy, not the guard.
 */
function exceeds(a: Money | null | undefined, b: Money | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.currency.toUpperCase() !== b.currency.toUpperCase()) return false;
  try {
    return toBigInt(a.amountMinor) > toBigInt(b.amountMinor);
  } catch {
    return false;
  }
}

/** Zero, or unreadable — both mean "do not treat this as a real figure". */
function isZeroish(m: Money | null | undefined): boolean {
  if (!m) return true;
  try {
    return toBigInt(m.amountMinor) === 0n;
  } catch {
    return true;
  }
}

/**
 * Is this record an attempt at the payout the user is confirming right now?
 *
 * Two questions, and both have to answer yes.
 *
 * WHAT. Every field that decides where the money goes has to agree. Anything
 * looser and an abandoned ₦50,000 to Chidi gets watched, settled and receipted
 * as the ₦20,000 to Ada the user is actually looking at — while Ada is never
 * paid. The comparison is made on the payout FINGERPRINT, the same one-way hash
 * the idempotency slot is derived from, so that resume identity and key
 * identity are computed from one field set rather than two: matching on the
 * destination tail while the key hashes the full digits makes two accounts at
 * one bank that share a last-4 one payout for the resume and two for the key,
 * and the record is then adopted while a second key is minted for it. A record
 * written before payouts carried a fingerprint falls back to its own fields.
 *
 * WHEN. The record has to have been started AFTER this draft's name enquiry
 * came back. A draft exists only because the user resolved that account moments
 * ago in this same process — it is never persisted — so a record older than the
 * resolution belongs to a payout set up before this one. An identical ₦5,000 to
 * Ada last week is not a retry of the ₦5,000 to Ada on screen now; without this
 * bound, mount resolves last week's record, finds it terminal, prints ITS
 * receipt as this transfer's and clears the draft, and this week's ₦5,000 is
 * never sent. An older record is an earlier payout, and earlier payouts are
 * resolved on their own panel before this one is priced.
 */
function describesDraft(record: PendingWithdrawal, draft: PayoutDraft | null): boolean {
  if (!draft) return false;
  if (record.startedAt < draft.resolvedAt) return false;
  if (record.fingerprint) return record.fingerprint === withdrawalFingerprint(draft);
  return (
    record.amountMinor.trim() === draft.amount.amountMinor.trim() &&
    record.currency.toUpperCase() === draft.amount.currency.toUpperCase() &&
    record.destinationBankUuid === draft.bankUuid &&
    record.destinationLast4 === lastFour(draft.accountNumber)
  );
}

interface Party {
  name?: string;
  bank?: string;
  /** The destination tail as a receipt prints it. */
  tail: string;
  amount: Money | null;
}

/**
 * The ONE transfer a panel is talking about.
 *
 * Fields never mix across sources. A resumed payout prints the account it went
 * to, taken from its own record — never the digits sitting in the draft the
 * user has just typed. That mix is how a settled ₦5,000 to Ada ends up printed
 * beside Jane's account tail and read as proof that Jane was paid.
 */
function party(
  wire: Withdrawal | null,
  record: PendingWithdrawal | null,
  draft: PayoutDraft | null,
): Party {
  if (record) {
    return {
      name: wire?.accountName ?? record.accountName,
      bank: wire?.bankName ?? record.bankName,
      tail: record.destinationLast4 === "" ? "—" : `•••• ${record.destinationLast4}`,
      amount: wire?.amount ?? { amountMinor: record.amountMinor, currency: record.currency },
    };
  }
  return {
    name: wire?.accountName ?? draft?.accountName,
    bank: wire?.bankName ?? draft?.bankName,
    tail: maskAccount(draft?.accountNumber),
    amount: wire?.amount ?? draft?.amount ?? null,
  };
}

export default function SendConfirmScreen({
  onBack,
  onDone,
  onNeedsSubscription,
}: {
  onBack?: () => void;
  /** The payout reached a state the user has been shown. */
  onDone?: () => void;
  onNeedsSubscription?: () => void;
}) {
  // Captured once: the draft is cleared when the payout terminates, and the
  // receipt still has to say who the money went to.
  const [draft] = useState<PayoutDraft | null>(() => getPayoutDraft());

  const [stage, setStage] = useState<Stage>("loading");
  const [quote, setQuote] = useState<WithdrawalQuote | null>(null);
  const [available, setAvailable] = useState<Money | null>(null);
  const [withdrawal, setWithdrawal] = useState<Withdrawal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  /** The record for the payout this screen is narrating, whichever one it is. */
  const [watched, setWatched] = useState<PendingWithdrawal | null>(null);
  /** `watched` belongs to an EARLIER payout, not to the draft on this screen. */
  const [priorPayout, setPriorPayout] = useState(false);
  /** This screen picked up its own payout, already in flight. */
  const [resumed, setResumed] = useState(false);
  /** Nothing is polling the payout on screen any more. Never claim otherwise. */
  const [unwatched, setUnwatched] = useState(false);

  const live = useRef(true);
  /**
   * The narrated payout, mirrored into refs.
   *
   * Tracker events can land before React has committed the state — the first
   * poll tick fires the moment tracking starts — and an update dropped for
   * that reason is a status lost over someone's money.
   */
  const watchedNow = useRef<PendingWithdrawal | null>(null);
  const priorNow = useRef(false);
  const narrate = useCallback((record: PendingWithdrawal | null, prior: boolean) => {
    watchedNow.current = record;
    priorNow.current = prior;
    setWatched(record);
    setPriorPayout(prior);
  }, []);
  /**
   * A payout has been POSTed under the reserved key.
   *
   * This — not the presence of a quote — is what makes "try again" mean replay
   * the request. It is also the only thing allowed to re-enter `submit()`
   * without the PIN, because the PIN was given for this exact operation and
   * the replay carries its key.
   */
  const released = useRef(false);

  // The route passes this as an inline arrow, so it is a new function every
  // render. Kept out of the dependency lists below: an identity change must
  // never be what tears down the poll watching someone's money.
  const paywall = useRef(onNeedsSubscription);
  paywall.current = onNeedsSubscription;

  const insufficient = quote !== null && exceeds(quote.totalDebit, available);
  /**
   * The quote reader defaults a missing total to "0". A zero total debit
   * against a non-zero amount is not a free transfer — it is a price we could
   * not read, and releasing money on it would be releasing money on a guess.
   */
  const unpriced = quote !== null && isZeroish(quote.totalDebit) && !isZeroish(draft?.amount);
  const blocked = insufficient || unpriced;
  // Read inside `submit`, which is a callback and cannot close over the value.
  const blockedNow = useRef(blocked);
  blockedNow.current = blocked;

  // The one motion moment: the seal arrives a beat after the screen, the way a
  // stamp lands on a document. Everything else here holds still.
  const seal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(seal, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [seal]);
  const lift = seal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  /**
   * Show the outcome. The key and the record are retired by whoever OBSERVED
   * the terminal state — the module tracker, or `submit()` below — because
   * that can happen when no screen is mounted at all.
   */
  const settle = useCallback((next: Withdrawal) => {
    clearPayoutDraft();
    setWithdrawal(next);
    setUnwatched(false);
    setStage(
      next.status === "SETTLED" || next.status === "DELIVERED" ? "settled" : "failed",
    );
  }, []);

  const price = useCallback(async () => {
    if (!draft) return;
    setStage("loading");
    setError(null);
    try {
      const [priced, balance] = await Promise.all([
        quoteWithdrawal(draft.amount),
        getBalance().catch(() => null),
      ]);
      if (!live.current) return;
      setQuote(priced);
      setAvailable(balance?.available ?? null);
      setStage("ready");
    } catch (err) {
      if (!live.current) return;
      if (SessionExpiredError.is(err)) {
        // Nothing has been sent yet, so this is safe to say plainly rather
        // than leaving the screen on a spinner that never resolves.
        setError("Your Paradigm session ended. Sign in again, then try this transfer.");
        setStage("error");
        return;
      }
      if (isEntitlementError(err)) {
        // The paywall callback is a toast, not a navigation — so the stage has
        // to resolve here too, or the screen sits on a spinner forever.
        paywall.current?.();
        setError("Naira payouts need an active Paradigm subscription.");
        setStage("error");
        return;
      }
      setError(describeLinkpayFailure(err));
      setStage("error");
    }
  }, [draft]);

  /** The earlier payout is done with. On to the one the user came here for. */
  const leavePrior = useCallback(async () => {
    narrate(null, false);
    setWithdrawal(null);
    setError(null);
    setUnwatched(false);
    if (!draft) {
      setStage("empty");
      return;
    }
    await price();
  }, [draft, narrate, price]);

  /** Ask the gateway again what became of the earlier payout. */
  const recheckPrior = useCallback(async () => {
    const record = watched;
    if (!record) return;
    setError(null);
    try {
      const outcome = await reconcilePendingWithdrawal(record);
      if (!live.current) return;
      if (outcome.withdrawal) {
        setWithdrawal(outcome.withdrawal);
        if (!outcome.retired) {
          setUnwatched(false);
          trackWithdrawal(record, outcome.withdrawal.id);
        }
        return;
      }
      if (!outcome.conclusive) {
        // "I could not find it" is not "it never happened". Dropping the key on
        // a lookup that only ran out of window would leave the next attempt at
        // this transfer free to mint a second key and debit the money twice.
        setUnwatched(true);
        setError(
          "Paradigm could not say what became of that transfer yet. Nothing here will send it again until it can.",
        );
        return;
      }
      // The gateway has nothing for it and the user is asking for something
      // else now: this operation can no longer be resumed, so its key goes.
      await retireWithdrawal(record);
      if (!live.current) return;
      await leavePrior();
    } catch (err) {
      if (!live.current) return;
      // Nothing is polling it and this check did not land either — the panel
      // must stop drawing a pulse over a transfer nobody is following.
      setUnwatched(true);
      setError(describeLinkpayFailure(err));
    }
  }, [watched, leavePrior]);

  /**
   * Tracker events, held in a ref rather than resubscribed.
   *
   * The tracker outlives this screen; a callback identity change must never be
   * what decides whether someone's money is still being followed.
   */
  const onEvent = useRef<(event: WithdrawalWatchEvent) => void>(() => {});
  onEvent.current = (event) => {
    // No record on screen means no panel is claiming to watch anything, and a
    // stray event for some other payout must not paint one.
    const record = watchedNow.current;
    if (!record) return;

    if (event.kind === "error") {
      // The payout is unaffected by a failed status check — say where it was
      // last seen rather than turning a poll error into a failed transfer.
      setError(
        SessionExpiredError.is(event.error)
          ? "Your session ended, so this stopped updating. The transfer itself carries on."
          : describeLinkpayFailure(event.error),
      );
      return;
    }
    if (event.kind === "stopped") {
      // Nobody is polling this any more. A spinner over someone's money that
      // nothing is feeding is a defect, so the screen stops claiming it.
      setUnwatched(true);
      return;
    }
    if (record.withdrawalId && record.withdrawalId !== event.withdrawal.id) return;
    setWithdrawal(event.withdrawal);
    setUnwatched(false);
    // A terminal EARLIER payout stays on its own panel: settling it here would
    // render it as this screen's receipt and destroy the draft it is not for.
    if (event.kind === "settled" && !priorNow.current) settle(event.withdrawal);
  };

  // Mount: resolve anything already in flight BEFORE offering to send.
  useEffect(() => {
    live.current = true;
    let cancelled = false;

    const unsubscribe = subscribeToWithdrawal((event) => {
      if (!live.current) return;
      onEvent.current(event);
    });

    (async () => {
      const pending = await loadPendingWithdrawal();
      if (cancelled) return;

      if (pending) {
        // Resume only a record that describes what the user is confirming.
        // With no draft at all, the record is the only payout in play — that
        // is the pure relaunch case this branch was written for.
        const ours = !draft || describesDraft(pending, draft);
        narrate(pending, !ours);
        setResumed(ours);

        const tracking = trackedWithdrawal();
        if (tracking && (!pending.withdrawalId || tracking.id === pending.withdrawalId)) {
          // Already being followed from an earlier mount. Adopt that poll
          // rather than starting a second one against the same payout.
          released.current = ours;
          if (tracking.latest) setWithdrawal(tracking.latest);
          setStage(ours ? "watching" : "prior");
          return;
        }

        if (pending.withdrawalId) {
          released.current = ours;
          setStage(ours ? "watching" : "prior");
          trackWithdrawal(pending, pending.withdrawalId);
          return;
        }

        // A payout whose answer never arrived. Ask the gateway what it has
        // instead of sending the same money again.
        setStage(ours ? "loading" : "prior");
        // No tracker is running against this one yet, and the prior panel's
        // pulse is the screen's way of saying a payout is being followed. It
        // stays off until something is actually following it.
        setUnwatched(!ours);
        let outcome: PendingOutcome | null = null;
        try {
          outcome = await reconcilePendingWithdrawal(pending);
        } catch (err) {
          if (cancelled) return;
          if (!ours) {
            // An earlier payout that cannot be resolved cannot be dismissed
            // either — its key is the only thing standing between a resume and
            // a second debit. Say so and let the user look again.
            setError(describeLinkpayFailure(err));
            return;
          }
          // Ours, and unresolved: nothing was sent that we can see. The key
          // stays reserved, so pricing and sending below is the SAME
          // operation, not a second one.
        }
        if (cancelled) return;

        if (outcome?.withdrawal) {
          if (ours) {
            released.current = true;
            setWithdrawal(outcome.withdrawal);
            if (outcome.retired) {
              settle(outcome.withdrawal);
              return;
            }
            setStage("watching");
            setUnwatched(false);
            trackWithdrawal(pending, outcome.withdrawal.id);
            return;
          }
          setWithdrawal(outcome.withdrawal);
          if (!outcome.retired) {
            setStage("prior");
            setUnwatched(false);
            trackWithdrawal(pending, outcome.withdrawal.id);
            return;
          }
          // The earlier payout is over and retired. Straight on to this one.
          narrate(null, false);
          setWithdrawal(null);
          setUnwatched(false);
        } else {
          if (!ours && outcome && !outcome.conclusive) {
            // The lookup came back empty without being able to say the gateway
            // never took it — the scan ran out of window, or a figure on the
            // feed would not parse. Retiring on that reads "I could not find
            // it" as "it never happened" and drops the one thing stopping this
            // transfer from going out a second time. The earlier payout stays
            // on its panel and the user can look again.
            setError(
              "Paradigm could not say what became of that transfer yet. Nothing here will send it again until it can.",
            );
            return;
          }
          if (!ours && outcome) {
            // Never received, conclusively, and the user is asking for
            // something else now. That is the second of the two legitimate
            // reasons to drop a key, the same move KycScreen makes when
            // refused details are edited.
            await retireWithdrawal(pending);
            if (cancelled) return;
          }
          narrate(null, false);
          setResumed(false);
          setUnwatched(false);
        }
      }

      if (!draft) {
        setStage("empty");
        return;
      }
      await price();
    })();

    return () => {
      cancelled = true;
      live.current = false;
      unsubscribe();
      // The tracker is deliberately NOT stopped. The payout is still in flight
      // and its key must still be released when it lands — a screen the user
      // was invited to leave cannot be what decides that.
    };
  }, [draft, narrate, price, settle]);

  const submit = useCallback(async () => {
    if (!draft) return;
    // A price the screen refused to trust must never become a payout. Once the
    // request is genuinely out there this stops applying: a replay under the
    // same key is the same operation, and refusing it would strand the money.
    if (!released.current && blockedNow.current) return;

    setStage("submitting");
    setError(null);

    // The record already on disk is read BEFORE anything is derived, because it
    // is the authority on an operation that may already be in flight: the key
    // it carries is the key the gateway may be holding, whatever slot this
    // build would derive for the same payout today. A record written before
    // payouts derived their own slots sits under the bare stem, and deriving a
    // slot for it would reserve an EMPTY one and mint a second key for money
    // already moving. The derived slot governs a NEW operation and nothing else.
    const earlier = await loadPendingWithdrawal();
    const resume = earlier && describesDraft(earlier, draft) ? earlier : null;
    if (earlier && !resume) {
      // A record for some OTHER payout, reached without the mount pass having
      // resolved it. Only one pending record exists at a time, so sending now
      // would overwrite it and orphan the key that is the only thing able to
      // stop that payout being sent a second time. Back to its panel instead —
      // nothing has been released here, so `released` stays as it was.
      narrate(earlier, true);
      setUnwatched(true);
      setPin("");
      setStage("prior");
      return;
    }

    released.current = true;
    // Reserved once per intended payout and reused by every retry below; on a
    // resume, taken from the record rather than derived at all.
    const plan = await planWithdrawal(draft, resume);
    // `startedAt` belongs to the FIRST attempt. Moving it forward on a retry
    // pushes `findPendingWithdrawal`'s floor past the withdrawal the first
    // attempt created, and the screen then reports sent money as not sent —
    // permanently, because the moved floor is what gets persisted.
    const record: PendingWithdrawal = {
      slot: plan.slot,
      idempotencyKey: plan.idempotencyKey,
      fingerprint: plan.fingerprint,
      amountMinor: draft.amount.amountMinor,
      currency: draft.amount.currency,
      destinationLast4: lastFour(draft.accountNumber),
      destinationBankUuid: draft.bankUuid,
      bankName: draft.bankName,
      accountName: draft.accountName,
      startedAt: resume ? resume.startedAt : Date.now(),
      withdrawalId: resume?.withdrawalId,
    };
    // Written BEFORE the request, so a crash mid-flight still leaves something
    // that can find the payout again.
    await savePendingWithdrawal(record);
    narrate(record, false);

    try {
      const next = await initiateWithdrawal(
        {
          amount: draft.amount,
          destinationAccount: draft.accountNumber,
          destinationBankUuid: draft.bankUuid,
        },
        plan.idempotencyKey,
      );

      // Everything from here to the tracker runs whether or not this screen is
      // still mounted. The key and the record belong to the OPERATION; a user
      // who walked away while the request was in the air must not be the
      // reason a settled payout keeps its key.
      const id =
        next.id ||
        record.withdrawalId ||
        (await findPendingWithdrawal(record).catch(() => null))?.withdrawal?.id ||
        "";
      const sent = id ? { ...record, withdrawalId: id } : record;
      if (id) {
        await savePendingWithdrawal(sent);
        // Re-narrated with the reference the gateway just gave back. The panel
        // reads `watched` for the id it would look the payout up by, so a
        // payout released in this session that is left with the id-less record
        // has no way back once the tracker stops — the 'Check again' button
        // that exists for exactly that moment would never be offered.
        narrate(sent, false);
      }

      if (isTerminalTransfer(next.status)) {
        await retireWithdrawal(sent);
        if (!live.current) return;
        settle(next);
        return;
      }
      if (id) trackWithdrawal(sent, id);
      if (!live.current) return;
      setWithdrawal(next);
      setStage("watching");
      if (!id) {
        // Accepted, but with no reference to follow it by. Claiming to watch
        // it would be the lie; the record survives so the next mount can find
        // it by amount and destination instead.
        setUnwatched(true);
      }
    } catch (err) {
      if (SessionExpiredError.is(err)) {
        if (!live.current) return;
        // The gateway refused a freshly refreshed token, so it never accepted
        // this payout. The reserved key and the pending record both stay, and
        // reopening this screen after signing in resumes the same operation.
        setPin("");
        setError("Your Paradigm session ended before this was sent. Sign in again and reopen it.");
        setStage("error");
        return;
      }
      // A timeout is not a failure. Before showing an error, ask whether the
      // payout exists — the client already replayed this with the same key.
      const found = (await findPendingWithdrawal(record).catch(() => null))?.withdrawal ?? null;
      if (found && found.id !== "") {
        const foundRecord = { ...record, withdrawalId: found.id };
        await savePendingWithdrawal(foundRecord);
        // Same reason as the success path: the panel needs the id to be able to
        // offer a way back if the tracker later gives up.
        narrate(foundRecord, false);
        if (isTerminalTransfer(found.status)) {
          await retireWithdrawal(foundRecord);
          if (!live.current) return;
          settle(found);
          return;
        }
        trackWithdrawal(foundRecord, found.id);
        if (!live.current) return;
        setWithdrawal(found);
        setUnwatched(false);
        setStage("watching");
        return;
      }
      if (!live.current) return;
      if (isEntitlementError(err)) {
        // Refused at the entitlement guard, so nothing was created. The key
        // stays reserved — it is unspent and this is still the same operation
        // — but the screen must stop claiming money is on its way.
        paywall.current?.();
        setPin("");
        setError(
          "Naira payouts need an active Paradigm subscription. Nothing has left your balance.",
        );
        setStage("error");
        return;
      }
      setPin("");
      setError(describeLinkpayFailure(err));
      setStage("error");
    }
  }, [draft, narrate, settle]);

  const handleKey = (k: string) => {
    if (stage !== "ready" || blocked) return;
    setPinError(null);
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length !== PIN_LENGTH) return;

    void (async () => {
      const ok = await storage.verifyPin(next);
      if (!live.current) return;
      if (!ok) {
        setPin("");
        setPinError("That PIN is not right.");
        return;
      }
      await submit();
    })();
  };

  /* -------------------------------------------------------------- states */

  if (stage === "empty") {
    return (
      <Screen center>
        <Display size={20} style={{ textAlign: "center" }}>
          Nothing to confirm
        </Display>
        <Body size={12.5} color={C.sub} style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}>
          Pick a bank, an account and an amount first — this screen only ever shows a transfer that
          has already been set up.
        </Body>
        <View style={{ marginTop: 28, alignSelf: "stretch" }}>
          <MetallicButton label="Back" onPress={onBack} />
        </View>
      </Screen>
    );
  }

  if (stage === "prior" && watched) {
    const done = withdrawal !== null && isTerminalTransfer(withdrawal.status);
    const them = party(withdrawal, watched, null);
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <Head title="One at a time" sub="AN EARLIER TRANSFER IS STILL OPEN" onBack={onBack} />
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {done || unwatched ? null : <PulseDot />}
            <Display size={19}>
              {done ? withdrawalStatusLabel(withdrawal.status) : "Still with the bank"}
            </Display>
          </View>
          <Body size={12.5} color={C.sub} style={{ marginTop: 14, lineHeight: 19 }}>
            {formatMoney(them.amount)} to {them.name ?? "an account you sent to"}
            {"\n"}
            {them.bank ?? "Their bank"} · {them.tail}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 16, lineHeight: 17.5 }}>
            {done
              ? "That one is finished. Your new transfer has not been priced or sent yet — carry on below."
              : unwatched
                ? // Two different silences, and the screen must not tell the
                  // second as if it were the first: a payout the gateway has
                  // confirmed carries on without us, while one we never managed
                  // to look up may not have been taken at all. Either way,
                  // nothing here is polling, so nothing here draws a pulse.
                  withdrawal !== null
                  ? "This screen has stopped checking on it. The transfer itself carries on."
                  : "Nothing here is checking on it just now. Its key is still held, so this cannot send it a second time."
                : "It has to land before a new transfer is set up, so the two can never be mistaken for each other. Nothing new has been sent."}
          </Body>
          {error ? (
            <Body size={11.5} color={C.down} style={{ marginTop: 14 }}>
              {error}
            </Body>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 22, paddingBottom: 34 }}>
          {done ? (
            <MetallicButton label="Continue with your transfer" onPress={() => void leavePrior()} />
          ) : (
            <MetallicButton label="Check again" onPress={() => void recheckPrior()} />
          )}
          <View style={{ marginTop: 12 }}>
            <GhostButton label="Done" onPress={onDone} />
          </View>
        </View>
      </View>
    );
  }

  if (stage === "settled") {
    const them = party(withdrawal, watched, draft);
    return (
      <Screen center>
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: C.upBg,
            borderWidth: 1,
            borderColor: "rgba(124,231,176,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={26} color={C.up} />
        </View>
        <Display size={23} style={{ marginTop: 20, textAlign: "center" }}>
          {withdrawalStatusLabel(withdrawal?.status ?? "SETTLED")}
        </Display>
        <Text
          style={{
            fontFamily: F.monoSemibold,
            fontSize: 30,
            lineHeight: 38,
            color: C.up,
            marginTop: 14,
          }}
        >
          {formatMoney(them.amount)}
        </Text>
        <Body size={12.5} color={C.sub} style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}>
          To {them.name ?? "the account you chose"}
          {"\n"}
          {them.bank ?? "Their bank"} · {them.tail}
        </Body>
        {withdrawal?.reference ? (
          <Mono size={10} color={C.dim} style={{ marginTop: 14, letterSpacing: 1.2 }}>
            REF {withdrawal.reference}
          </Mono>
        ) : null}
        <View style={{ marginTop: 30, alignSelf: "stretch" }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  if (stage === "failed") {
    const reversed = withdrawal?.status === "REVERSED";
    const them = party(withdrawal, watched, draft);
    return (
      <Screen center>
        <Display size={22} style={{ textAlign: "center" }}>
          {reversed ? "That transfer was reversed" : "That transfer did not go through"}
        </Display>
        <Body size={13} color={C.down} style={{ marginTop: 14, textAlign: "center", lineHeight: 19 }}>
          {withdrawal?.failureReason ??
            (reversed
              ? "The bank sent it back. The money is in your Paradigm balance."
              : "The bank turned it down. Nothing has left your balance.")}
        </Body>
        <Body size={12} color={C.dim} style={{ marginTop: 16, textAlign: "center", lineHeight: 18 }}>
          {formatMoney(them.amount)} to {them.name ?? "the account you chose"}
        </Body>
        <View style={{ marginTop: 30, alignSelf: "stretch" }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  if (stage === "watching" || stage === "submitting") {
    const status = withdrawal?.status;
    const them = party(withdrawal, watched, draft);
    // "Watching" while nothing is polling would be a claim the screen cannot
    // back. Submitting is different: that request is genuinely in the air.
    const stalled = stage === "watching" && unwatched;
    // Only a payout with a reference can be looked up again.
    const resumeId = watched?.withdrawalId;
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <Head
          title={stage === "submitting" ? "Releasing" : "On its way"}
          sub={resumed ? "PICKED UP WHERE YOU LEFT OFF" : "THE BANK HAS IT"}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {stage === "submitting" ? <Spinner /> : stalled ? null : <PulseDot />}
            <Display size={19}>
              {stage === "submitting"
                ? "Sending it now"
                : withdrawalStatusLabel(status ?? "SUBMITTED")}
            </Display>
          </View>
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 34,
              lineHeight: 42,
              color: C.text,
              marginTop: 22,
            }}
          >
            {formatMoney(them.amount)}
          </Text>
          <Body size={12.5} color={C.sub} style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}>
            To {them.name ?? "the account you chose"}
            {"\n"}
            {them.bank ?? "Their bank"} · {them.tail}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 22, textAlign: "center", lineHeight: 17.5 }}>
            {stalled
              ? "This screen has stopped checking on it. The transfer itself carries on, and the fiat space shows where it got to."
              : "You can leave this screen. The transfer keeps going, and the fiat space shows where it got to."}
          </Body>
          {error ? (
            <Body size={11.5} color={C.down} style={{ marginTop: 14, textAlign: "center" }}>
              {error}
            </Body>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 22, paddingBottom: 34 }}>
          {stalled && watched && resumeId ? (
            <View style={{ marginBottom: 12 }}>
              <MetallicButton
                label="Check again"
                onPress={() => {
                  setUnwatched(false);
                  trackWithdrawal(watched, resumeId);
                }}
              />
            </View>
          ) : null}
          <GhostButton label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }

  // `prior` with no record left is the beat between retiring an earlier payout
  // and pricing this one — the pricing panel, not a half-built confirm screen.
  if (stage === "loading" || stage === "prior") {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <Head title="Confirm" sub="PRICING THIS TRANSFER" onBack={onBack} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Spinner />
          <Body size={12.5} color={C.dim} style={{ marginTop: 14 }}>
            Asking the provider what this costs
          </Body>
        </View>
      </View>
    );
  }

  if (stage === "error") {
    // What "try again" means depends on whether a payout was ever released —
    // never on whether a stale quote object happens to be sitting in state.
    const replaying = released.current;
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <Head title="Confirm" sub="THAT DID NOT GO THROUGH" onBack={onBack} />
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 26 }}>
          <Display size={19}>Could not complete that</Display>
          <Body size={13} color={C.down} style={{ marginTop: 12, lineHeight: 19 }}>
            {error ?? "Something went wrong reaching Paradigm."}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 16, lineHeight: 17.5 }}>
            {replaying
              ? "Trying again repeats the SAME request rather than starting a second one, so this cannot send the money twice."
              : "Nothing has been sent. This only asks Paradigm to price the transfer again, and your PIN still releases it."}
          </Body>
          <View style={{ marginTop: 26 }}>
            <MetallicButton
              label={replaying ? "Try again" : "Price it again"}
              onPress={() => void (replaying ? submit() : price())}
            />
          </View>
          <View style={{ marginTop: 12 }}>
            <GhostButton label="Back" onPress={onBack} />
          </View>
        </View>
      </View>
    );
  }

  /* --------------------------------------------------------------- ready */

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Head title="Confirm" sub="LAST LOOK BEFORE IT LEAVES" onBack={onBack} />

      {/* The stack below is ~830pt tall and only a Pro Max has room for it.
          `flexGrow: 1` keeps the container at least a viewport high, so the
          keypad still sits at the bottom on a big phone, while on a 13 mini or
          an SE the "0" and delete keys scroll into reach instead of hanging off
          the bottom edge with no way to reach them. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* The seal: the name the bank gave back, staged as the proof it is. */}
        <Animated.View
          style={{
            marginTop: 18,
            marginHorizontal: 20,
            opacity: seal,
            transform: [{ translateY: lift }],
          }}
        >
          <View
            style={{
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: "rgba(131,190,96,0.34)",
              borderRadius: 20,
              overflow: "hidden",
              shadowColor: C.brand,
              shadowOpacity: 0.1,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Shine />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 16,
                paddingTop: 16,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: C.brandGlow,
                  borderWidth: 1,
                  borderColor: "rgba(131,190,96,0.34)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Check size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Mono size={8.5} color={C.brandSoft} style={{ letterSpacing: 1.6 }}>
                  NAME ENQUIRY
                </Mono>
                <Body size={15} semibold style={{ letterSpacing: 0.4, marginTop: 4 }}>
                  {draft?.accountName}
                </Body>
                <Mono size={11} color={C.sub} style={{ marginTop: 3 }}>
                  {draft?.bankName} · {maskAccount(draft?.accountNumber)}
                </Mono>
              </View>
            </View>
            <View style={{ paddingHorizontal: 16 }}>
              <SectionRule space={14} />
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Body size={11.5} color={C.dim} style={{ lineHeight: 17 }}>
                Returned by {draft?.bankName} at {clock(draft?.resolvedAt ?? Date.now())}. A bank
                transfer cannot be recalled once it is sent.
              </Body>
            </View>
          </View>
        </Animated.View>

        <View style={{ marginTop: 22, alignItems: "center" }}>
          <Label style={{ letterSpacing: 2 }}>You're sending</Label>
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 40,
              letterSpacing: -0.5,
              color: C.text,
              marginTop: 12,
            }}
          >
            {formatMoney(draft?.amount)}
          </Text>
        </View>

        <View
          style={{
            marginTop: 22,
            marginHorizontal: 20,
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: blocked ? "rgba(246,165,165,0.4)" : C.hairline,
            borderRadius: 18,
            paddingHorizontal: 16,
            overflow: "hidden",
          }}
        >
          <Shine />
          <Row
            label="FEE"
            value={formatMoney(quote?.fee)}
            note="charged on top · provider quote"
          />
          <Row
            label="TOTAL DEBIT"
            value={formatMoney(quote?.totalDebit)}
            strong
            last={available === null}
          />
          {available !== null ? (
            <Row label="AVAILABLE" value={formatMoney(available)} last />
          ) : null}
        </View>

        <View style={{ marginTop: "auto", paddingTop: 26, paddingHorizontal: 22, paddingBottom: 28 }}>
          {blocked ? (
            <>
              <Body size={12.5} color={C.down} style={{ textAlign: "center", lineHeight: 18 }}>
                {insufficient
                  ? "The fee takes this past your balance. Go back and send a smaller amount."
                  : "Paradigm could not read a price for this transfer, so it will not release it. Try again in a moment."}
              </Body>
              <View style={{ marginTop: 16 }}>
                <GhostButton
                  label={insufficient ? "Change the amount" : "Price it again"}
                  onPress={insufficient ? onBack : () => void price()}
                />
              </View>
            </>
          ) : (
            <>
              <Body size={12.5} color={pinError ? C.down : C.sub} style={{ textAlign: "center" }}>
                {pinError ?? "Your PIN releases the transfer."}
              </Body>
              <View style={{ marginTop: 16, marginBottom: 18 }}>
                <PinDots filled={pin.length} />
              </View>
              <Keypad onKey={handleKey} />
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
