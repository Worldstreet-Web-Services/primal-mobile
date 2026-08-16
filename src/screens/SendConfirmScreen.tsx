import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
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
  WITHDRAWAL_SLOT,
  clearPendingWithdrawal,
  describeLinkpayFailure,
  findPendingWithdrawal,
  getBalance,
  initiateWithdrawal,
  lastFour,
  loadPendingWithdrawal,
  maskAccount,
  quoteWithdrawal,
  releaseIdempotencyKey,
  reserveIdempotencyKey,
  savePendingWithdrawal,
  watchWithdrawal,
  withdrawalStatusLabel,
  type PendingWithdrawal,
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
 * The screen is built around three facts it must not get wrong.
 *
 * 1. **The name is the proof.** It came back from the bank on the previous
 *    screen and the user accepted it there; it is restated here because a
 *    transfer cannot be recalled.
 * 2. **The fee is charged ON TOP.** The gateway quotes `fee` and `totalDebit`
 *    separately, and the figure that leaves the balance is the total — so the
 *    total is the one set in the heavier type, not the amount.
 * 3. **One payout, one key.** The idempotency key is reserved when the PIN is
 *    accepted and reused by every retry. A timeout does not mint a second one;
 *    it asks the gateway what it already has. On a relaunch mid-flight this
 *    screen resumes the existing payout instead of offering to send again.
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
  | "error";

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
  /** This screen picked up a payout that was already in flight. */
  const [resumed, setResumed] = useState(false);

  const stopWatch = useRef<(() => void) | null>(null);
  const live = useRef(true);

  // The route passes this as an inline arrow, so it is a new function every
  // render. Kept out of the dependency lists below: an identity change must
  // never be what tears down the poll watching someone's money.
  const paywall = useRef(onNeedsSubscription);
  paywall.current = onNeedsSubscription;

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

  const finish = useCallback(async (settled: Withdrawal) => {
    // Terminal: the key has done its job, and the record of an in-flight payout
    // must not outlive the payout — a stale one would hijack the next transfer.
    await releaseIdempotencyKey(WITHDRAWAL_SLOT);
    await clearPendingWithdrawal();
    clearPayoutDraft();
    if (!live.current) return;
    setWithdrawal(settled);
    setStage(
      settled.status === "SETTLED" || settled.status === "DELIVERED" ? "settled" : "failed",
    );
  }, []);

  const watch = useCallback(
    (id: string) => {
      stopWatch.current?.();
      stopWatch.current = watchWithdrawal(
        id,
        (next) => {
          if (!live.current) return;
          setWithdrawal(next);
          if (isTerminalTransfer(next.status)) void finish(next);
        },
        {
          intervalMs: 4_000,
          maxMs: 5 * 60 * 1000,
          onError: (err) => {
            if (!live.current) return;
            if (SessionExpiredError.is(err)) {
              // The poll stops itself. The transfer is unaffected — say where
              // it was last seen rather than implying it stalled.
              setError("Your session ended, so this stopped updating. The transfer itself carries on.");
              return;
            }
            // The payout is unaffected by a failed poll — say so in place
            // rather than turning a status check into a failed transfer.
            setError(describeLinkpayFailure(err));
          },
        },
      );
    },
    [finish],
  );

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
        paywall.current?.();
        return;
      }
      setError(describeLinkpayFailure(err));
      setStage("error");
    }
  }, [draft]);

  // Mount: resume anything already in flight BEFORE offering to send.
  useEffect(() => {
    live.current = true;
    let cancelled = false;

    (async () => {
      const pending = await loadPendingWithdrawal();
      if (cancelled) return;

      if (pending) {
        setResumed(true);
        if (pending.withdrawalId) {
          setStage("watching");
          watch(pending.withdrawalId);
          return;
        }
        // A payout whose answer never arrived. Ask the gateway what it has
        // instead of sending the same money again.
        const found = await findPendingWithdrawal(pending).catch(() => null);
        if (cancelled) return;
        if (found) {
          await savePendingWithdrawal({ ...pending, withdrawalId: found.id });
          setWithdrawal(found);
          if (isTerminalTransfer(found.status)) {
            await finish(found);
            return;
          }
          setStage("watching");
          if (found.id) watch(found.id);
          return;
        }
        // Nothing on the gateway: the request never took. The reserved key
        // stays reserved, so trying again is the same operation.
        setResumed(false);
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
      stopWatch.current?.();
    };
  }, [draft, finish, price, watch]);

  const submit = useCallback(async () => {
    if (!draft) return;
    setStage("submitting");
    setError(null);

    // Reserved once per intended payout and reused by every retry below.
    const key = await reserveIdempotencyKey(WITHDRAWAL_SLOT, "withdrawal");
    const record: PendingWithdrawal = {
      idempotencyKey: key,
      amountMinor: draft.amount.amountMinor,
      currency: draft.amount.currency,
      destinationLast4: lastFour(draft.accountNumber),
      destinationBankUuid: draft.bankUuid,
      bankName: draft.bankName,
      accountName: draft.accountName,
      startedAt: Date.now(),
    };
    // Written BEFORE the request, so a crash mid-flight still leaves something
    // that can find the payout again.
    await savePendingWithdrawal(record);

    try {
      const next = await initiateWithdrawal(
        {
          amount: draft.amount,
          destinationAccount: draft.accountNumber,
          destinationBankUuid: draft.bankUuid,
        },
        key,
      );
      if (!live.current) return;
      setWithdrawal(next);

      const id = next.id || (await findPendingWithdrawal(record).catch(() => null))?.id || "";
      if (id) await savePendingWithdrawal({ ...record, withdrawalId: id });

      if (isTerminalTransfer(next.status)) {
        await finish(next);
        return;
      }
      setStage("watching");
      if (id) watch(id);
    } catch (err) {
      if (!live.current) return;
      if (SessionExpiredError.is(err)) {
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
      const found = await findPendingWithdrawal(record).catch(() => null);
      if (!live.current) return;
      if (found) {
        await savePendingWithdrawal({ ...record, withdrawalId: found.id });
        setWithdrawal(found);
        if (isTerminalTransfer(found.status)) {
          await finish(found);
          return;
        }
        setStage("watching");
        if (found.id) watch(found.id);
        return;
      }
      if (isEntitlementError(err)) {
        paywall.current?.();
        return;
      }
      setPin("");
      setError(describeLinkpayFailure(err));
      setStage("error");
    }
  }, [draft, finish, watch]);

  const insufficient = quote !== null && exceeds(quote.totalDebit, available);
  /**
   * The quote reader defaults a missing total to "0". A zero total debit
   * against a non-zero amount is not a free transfer — it is a price we could
   * not read, and releasing money on it would be releasing money on a guess.
   */
  const unpriced = quote !== null && isZeroish(quote.totalDebit) && !isZeroish(draft?.amount);
  const blocked = insufficient || unpriced;

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

  if (stage === "settled") {
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
          {formatMoney(withdrawal?.amount ?? draft?.amount)}
        </Text>
        <Body size={12.5} color={C.sub} style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}>
          To {withdrawal?.accountName ?? draft?.accountName ?? "the account you chose"}
          {"\n"}
          {withdrawal?.bankName ?? draft?.bankName} · {maskAccount(draft?.accountNumber)}
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
          {formatMoney(withdrawal?.amount ?? draft?.amount)} to{" "}
          {withdrawal?.accountName ?? draft?.accountName ?? "the account you chose"}
        </Body>
        <View style={{ marginTop: 30, alignSelf: "stretch" }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  if (stage === "watching" || stage === "submitting") {
    const status = withdrawal?.status;
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <Head
          title={stage === "submitting" ? "Releasing" : "On its way"}
          sub={resumed ? "PICKED UP WHERE YOU LEFT OFF" : "THE BANK HAS IT"}
        />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {stage === "submitting" ? <Spinner /> : <PulseDot />}
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
            {formatMoney(withdrawal?.amount ?? draft?.amount)}
          </Text>
          <Body size={12.5} color={C.sub} style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}>
            To {withdrawal?.accountName ?? draft?.accountName ?? "the account you chose"}
            {"\n"}
            {withdrawal?.bankName ?? draft?.bankName} · {maskAccount(draft?.accountNumber)}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 22, textAlign: "center", lineHeight: 17.5 }}>
            You can leave this screen. The transfer keeps going, and the fiat space shows where it
            got to.
          </Body>
          {error ? (
            <Body size={11.5} color={C.down} style={{ marginTop: 14, textAlign: "center" }}>
              {error}
            </Body>
          ) : null}
        </View>
        <View style={{ paddingHorizontal: 22, paddingBottom: 34 }}>
          <GhostButton label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }

  if (stage === "loading") {
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
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <Head title="Confirm" sub="THAT DID NOT GO THROUGH" onBack={onBack} />
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 26 }}>
          <Display size={19}>Could not complete that</Display>
          <Body size={13} color={C.down} style={{ marginTop: 12, lineHeight: 19 }}>
            {error ?? "Something went wrong reaching Paradigm."}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 16, lineHeight: 17.5 }}>
            Trying again repeats the SAME request rather than starting a second one, so this cannot
            send the money twice.
          </Body>
          <View style={{ marginTop: 26 }}>
            <MetallicButton
              label="Try again"
              onPress={() => void (quote ? submit() : price())}
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
    </View>
  );
}
