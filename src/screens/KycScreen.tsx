import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  BackHeader,
  Body,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  PulseDot,
  Screen,
  SectionRule,
  Shine,
  Spinner,
} from "../components/ui";
import { useLinkpayAccount } from "../hooks/useLinkpay";
import { isEntitlementRefusal } from "../lib/gateway/entitlement";
import {
  PROVISION_SLOT,
  accountStatusLabel,
  describeLinkpayFailure,
  isAccountUsable,
  provisionAccount,
  releaseIdempotencyKey,
  reserveIdempotencyKey,
} from "../lib/gateway/linkpay";
import {
  ApiError,
  NetworkError,
  SessionExpiredError,
} from "../lib/gateway/types";
import { C, F, withAlpha } from "../theme/tokens";

/**
 * Opening a naira account: the one form in the app that asks for a BVN.
 *
 * Three rules this screen exists to keep:
 *
 * 1. **The BVN lives in form state and nowhere else.** It is never logged,
 *    never persisted, never attached to the idempotency record, and it is
 *    dropped from state the moment the request that needed it has been sent.
 *    Nothing on this screen writes it anywhere a crash reporter could reach.
 * 2. **One idempotency key per intended account.** It is reserved when the user
 *    commits, persisted by the client layer, and REUSED on every retry — a
 *    timeout is not a failure, and a second key is a second customer at the
 *    provider. The only thing that drops the key is a terminal refusal the user
 *    then corrects.
 * 3. **PENDING_KYC and CUSTOMER_CREATED are not endings.** They mean the bank
 *    is still working. The screen waits and re-asks rather than sending the
 *    person back through a form they already filled in.
 */

const COUNTRY = "NG";
const CURRENCY = "NGN";

/** 11 digits, and nothing about the number is checkable client-side. */
const BVN_LENGTH = 11;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 4xx codes that leave THIS provisioning attempt resumable, so its key has to
 * survive them:
 *
 * - `401` — unauthenticated, so the gateway did not read the body. The session
 *   layer is already retrying behind us; the operation itself is untouched.
 * - `403` — entitlement. The same details work the moment the subscription is
 *   live, and that is a payment away, not a correction.
 * - `408` / `429` — "ask again", and asking again must carry the same key or it
 *   is a second customer at the provider.
 * - `409` — the gateway already holds this key under a different body. Whether
 *   THAT body opened an account is not knowable from here, so the key is not
 *   ours to drop without looking.
 */
const RESUMABLE_4XX = new Set([401, 403, 408, 409, 429]);

/**
 * A refusal the gateway will repeat forever: it read the body, said no, and
 * created nothing behind the key.
 *
 * 5xx and network failures are deliberately absent — those are ambiguous about
 * whether the account was opened, and ambiguity replays the key rather than
 * minting a new one.
 */
function isTerminalRefusal(error: unknown): boolean {
  return (
    ApiError.is(error) &&
    error.statusCode >= 400 &&
    error.statusCode < 500 &&
    !RESUMABLE_4XX.has(error.statusCode)
  );
}

/**
 * Nigerian mobile numbers, in the two shapes people actually type. The value is
 * sent as typed (trimmed) — normalising it into a format the provider did not
 * ask for is a guess, and this screen does not guess with someone's identity.
 */
function validPhone(input: string): boolean {
  const digits = input.replace(/[\s()-]/g, "");
  return /^0\d{10}$/.test(digits) || /^(\+?234)\d{10}$/.test(digits);
}

function Check({ size = 26, color = C.up }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  keyboardType,
  maxLength,
  autoCapitalize = "words",
  mono,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  error?: string | null;
  hint?: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  maxLength?: number;
  autoCapitalize?: "none" | "words" | "characters";
  /** Digits read better in the mono face — account numbers, BVNs, phones. */
  mono?: boolean;
}) {
  return (
    <View className="mt-[16px]">
      <Label>{label}</Label>
      <View
        className="mt-[8px] bg-canvas-raised border rounded-[14px] px-[14px] overflow-hidden"
        style={{
          borderColor: error ? withAlpha(C.down, 0.45) : C.hairline,
        }}
      >
        <Shine />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.dim}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          // Nothing on this form is a credential the OS should remember for us.
          autoComplete="off"
          textContentType="none"
          className="h-[50px] text-text"
          style={{
            fontFamily: mono ? F.monoSemibold : F.body,
            fontSize: mono ? 15.5 : 14.5,
            letterSpacing: mono ? 1.2 : 0,
          }}
        />
      </View>
      {error ? (
        <Body className="text-[11.5px] text-down mt-[7px]">{error}</Body>
      ) : hint ? (
        <Body className="text-[11px] text-dim mt-[7px] leading-[16px]">
          {hint}
        </Body>
      ) : null}
    </View>
  );
}

/** A fact the user cannot change, shown rather than hidden. */
function FixedRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      className="flex-row items-center justify-between py-[13px] border-b-rule"
      style={{
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <Mono className="text-[10px] text-dim tracking-[1.3px]">{label}</Mono>
      <Mono className="text-[12.5px] text-silver">{value}</Mono>
    </View>
  );
}

export default function KycScreen({
  onBack,
  onDone,
  onNeedsSubscription,
  onNeedsSignIn,
}: {
  onBack?: () => void;
  /** The account reached ACTIVE. */
  onDone?: () => void;
  onNeedsSubscription?: () => void;
  onNeedsSignIn?: () => void;
}) {
  const {
    phase,
    account,
    error: accountError,
    // Which wait an `activating` phase is. The two read very differently to
    // the person waiting, and only one of them has had money leave.
    activation,
    // "The account has been asked about and has not answered yet." Both
    // controls on this screen that can drop an idempotency key wait for it.
    refreshing: rereading,
    // Whether the hook is still re-asking on its own. The "with the bank" panel
    // states a cadence, and a stated cadence has to be one that is running.
    watching,
    reload,
  } = useLinkpayAccount();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  // Form state only. Never persisted, never logged, cleared after the send.
  const [bvn, setBvn] = useState("");

  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /**
   * The user is correcting details the bank turned down — swap the
   * PROVISION_FAILED panel for the form.
   *
   * It belongs to that one panel and to nothing else. A flag that outlived it
   * would suppress whatever screen the account's REAL state had earned — the
   * "with the bank" panel most of all — and drop the person onto the form
   * instead, which is a request to open a second account.
   */
  const [correcting, setCorrecting] = useState(false);
  /**
   * A 409: the gateway holds this key under details other than the ones just
   * sent. Only the user can say whether to start the operation over, so the
   * screen offers it rather than dropping the key on its own.
   */
  const [conflicted, setConflicted] = useState(false);

  // `correcting` is scoped to the panel that sets it, in code and not just in
  // intent: the moment the account reads as anything else — the bank picked it
  // up, it opened, it vanished — the panel it was hiding is gone and the flag
  // goes with it. Cleared on the phase change rather than on the next submit,
  // because there may not be a next submit.
  useEffect(() => {
    if (phase !== "provision_failed") setCorrecting(false);
    // And the 409 offer is withdrawn the moment the gateway names an account:
    // the key belongs to that account now, so "clear it and send these details
    // as a new one" is no longer a thing to offer anybody. PROVISION_FAILED is
    // the exception the offer was written for — that account is finished with
    // the key. A transient `loading` is deliberately not in this list: it says
    // nothing about the account, and taking the escape hatch away over it would
    // be a worse answer than leaving it up.
    if (
      phase === "ready" ||
      phase === "provisioning" ||
      phase === "disabled" ||
      phase === "unknown_status"
    ) {
      setConflicted(false);
    }
  }, [phase]);

  // `unentitled` only. `activating` is a wait with its own panel below — a
  // member whose USD 1,000 is mid-flight must never be handed the paywall.
  const told = useRef(false);
  useEffect(() => {
    if (phase !== "unentitled") {
      told.current = false;
      return;
    }
    if (told.current) return;
    told.current = true;
    onNeedsSubscription?.();
  }, [phase, onNeedsSubscription]);

  const problems = {
    firstName:
      firstName.trim().length < 2
        ? "Your first name, as your bank has it."
        : null,
    lastName:
      lastName.trim().length < 2 ? "Your surname, as your bank has it." : null,
    phoneNumber: validPhone(phoneNumber)
      ? null
      : "An 11-digit Nigerian number, e.g. 08012345678.",
    email: EMAIL_PATTERN.test(email.trim())
      ? null
      : "An email address the bank can reach you on.",
    bvn:
      bvn.replace(/\D/g, "").length === BVN_LENGTH
        ? null
        : `Your BVN is ${BVN_LENGTH} digits.`,
  };
  const complete = Object.values(problems).every((p) => p === null);

  const submit = async () => {
    setTouched(true);
    // A re-read that has been asked for and not answered is the one state in
    // which this form must not send: every path that drops the key asks the
    // gateway what it actually holds, and sending before that answer lands is
    // how a fresh key meets an account nobody has looked at.
    if (!complete || submitting || rereading) return;

    setSubmitting(true);
    setSubmitError(null);
    setConflicted(false);

    try {
      // Reserved once and reused on every retry of THIS account. The client
      // layer persists it, so a crash between here and the response replays the
      // same key instead of opening a second account.
      const key = await reserveIdempotencyKey(PROVISION_SLOT, "provision");

      const next = await provisionAccount(
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: phoneNumber.trim(),
          email: email.trim(),
          bvn: bvn.replace(/\D/g, ""),
          country: COUNTRY,
          currency: CURRENCY,
        },
        key,
      );

      // Done with it. Nothing downstream needs the number.
      setBvn("");
      setCorrecting(false);

      if (isAccountUsable(next.status)) {
        // Terminal success — the key has done its job and must not be reused.
        await releaseIdempotencyKey(PROVISION_SLOT);
      }
      // PENDING_KYC / CUSTOMER_CREATED keep the key: they are the middle of
      // this operation, not the end of it, and a retry has to carry it.
      reload();
    } catch (err) {
      if (SessionExpiredError.is(err)) return;
      // Any 403 on this route is the entitlement guard, whatever the body says.
      if (isEntitlementRefusal(err)) {
        onNeedsSubscription?.();
        return;
      }
      if (NetworkError.is(err) && err.timedOut) {
        // A timeout is not a failure. The account may exist already, so ask —
        // never send the same details again under a fresh key.
        setSubmitError(
          "That request took too long to answer. Checking whether your account was opened anyway…",
        );
        reload();
        return;
      }

      if (isTerminalRefusal(err)) {
        // The gateway read these details and refused them, so there is no
        // half-open account behind the key and nothing left for it to name.
        // The correction the user is about to type is a different operation and
        // needs its own key: keeping this one would meet the corrected details
        // with a 409 and leave them clearing it by hand on the screen that has
        // just told them their details were wrong.
        await releaseIdempotencyKey(PROVISION_SLOT);
        // And re-read before the next tap can mint a key: if the refusal was
        // wrong about having created nothing, this screen turns into the
        // account panel and the form is never offered a second time. That is a
        // precondition, not a hope — `reload` marks the re-read outstanding
        // synchronously and the submit button is held until it answers, so the
        // next tap genuinely cannot land inside the round trip.
        reload();
      } else if (ApiError.is(err) && err.statusCode === 409) {
        // The gateway already has this key under a different shape. That older
        // body may have opened an account — re-read before believing otherwise,
        // and let the user be the one to start it over.
        setConflicted(true);
        reload();
      }
      setSubmitError(describeLinkpayFailure(err));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Drop the key the gateway is holding so the next tap is a NEW attempt.
   *
   * Both callers are an explicit decision, taken in front of a screen that has
   * said what is being dropped, and — this is the part that makes the drop
   * safe — both are held closed while a re-read is outstanding. The account the
   * screen is looking at is therefore one the gateway has just described, not
   * the one it described before the request that went wrong.
   */
  const startOver = async () => {
    await releaseIdempotencyKey(PROVISION_SLOT);
    setSubmitError(null);
    setConflicted(false);
  };

  /**
   * Correct details the bank turned down.
   *
   * PROVISION_FAILED is terminal for that key — replaying it would replay the
   * refusal — and this is the one control that opens the form over a panel, so
   * it is the one place `correcting` is set. The 409 escape hatch does NOT set
   * it: that control lives on the form already, and a flag raised from there
   * would follow the user into a phase that has its own screen to show.
   */
  const correctRefusedDetails = async () => {
    await startOver();
    setCorrecting(true);
  };

  const header = (title: string, sub: string) => (
    <View>
      <BackHeader title={title} onBack={onBack} />
      <Mono className="text-[9.5px] text-dim tracking-[1.4px] mt-[2px]">
        {sub}
      </Mono>
    </View>
  );

  if (phase === "loading") {
    return (
      <Screen>
        {header("Naira account", "CHECKING WHERE YOU ARE")}
        <View className="mt-[60px] items-center">
          <Spinner />
        </View>
      </Screen>
    );
  }

  if (phase === "signed_out") {
    return (
      <Screen>
        {header("Naira account", "SIGN IN FIRST")}
        <Body className="text-[13px] text-sub mt-[24px] leading-[19px]">
          Sign in to KashPlus and this account opens against your own identity.
        </Body>
        <View className="mt-[20px]">
          <MetallicButton label="Sign in" onPress={onNeedsSignIn} />
        </View>
      </Screen>
    );
  }

  if (phase === "unentitled") {
    return (
      <Screen>
        {header("Naira account", "SUBSCRIPTION REQUIRED")}
        <Body className="text-[13px] text-sub mt-[24px] leading-[19px]">
          A naira account is part of a KashPlus subscription. Nothing is wrong
          with your sign-in — the subscription is what is missing.
        </Body>
        <View className="mt-[20px]">
          <MetallicButton label="See the plan" onPress={onNeedsSubscription} />
        </View>
      </Screen>
    );
  }

  // Paid, or paying. The form stays closed because the gateway will refuse it
  // until the entitlement lands — but the answer is "hold on", never "pay".
  if (phase === "activating") {
    const paying = activation === "payment";
    return (
      <Screen>
        {header("Naira account", paying ? "PAYMENT IN FLIGHT" : "ALMOST OPEN")}
        <View
          className="mt-[30px] bg-canvas-raised border rounded-[20px] p-[20px] overflow-hidden"
          style={{
            borderColor: withAlpha(C.amber, 0.3),
          }}
        >
          <Shine />
          <View className="flex-row items-center gap-[9px]">
            {watching ? <PulseDot /> : null}
            <Display className="text-[18px] leading-[18.9px]">
              {paying
                ? "Your payment is still on its way"
                : "Switching your membership on"}
            </Display>
          </View>
          <Body className="text-[12.5px] text-sub mt-[12px] leading-[19px]">
            {paying
              ? "KashPlus is waiting for your subscription transfer to land. A naira account opens the moment it does — nothing here needs paying twice."
              : "Your payment is in and the gateway is still switching the naira side on. It usually takes a moment, and nothing needs paying again."}
          </Body>
          <SectionRule space={16} />
          {/* Only claimed while it is true — the hook stops asking when this
              screen is not in front, in the background, and once its window is
              spent. */}
          <Mono className="text-[10px] text-dim tracking-[1.3px]">
            {watching
              ? "CHECKING EVERY FEW SECONDS"
              : "CHECK WHEN YOU ARE READY"}
          </Mono>
        </View>
        <View className="mt-[22px]">
          <GhostButton label="Check now" onPress={reload} />
        </View>
      </Screen>
    );
  }

  if (phase === "ready") {
    return (
      <Screen center>
        <View
          className="w-[62px] h-[62px] rounded-[31px] bg-up-tint border items-center justify-center"
          style={{
            borderColor: withAlpha(C.up, 0.35),
          }}
        >
          <Check />
        </View>
        <Display className="text-[23px] leading-[24.15px] mt-[20px] text-center">
          Your account is open
        </Display>
        {account?.accountNumber ? (
          <Text className="font-mono-semibold text-[26px] tracking-[2.5px] text-text mt-[16px]">
            {account.accountNumber}
          </Text>
        ) : null}
        <Body className="text-[12.5px] text-sub mt-[10px] text-center leading-[19px]">
          {account?.bankName ? `${account.bankName} · ` : ""}
          {account?.accountName ?? "In your name"}
        </Body>
        <View className="mt-[30px]" style={{ alignSelf: "stretch" }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  // No `correcting` escape here on purpose: while the bank is actively working
  // on the account there is nothing for a correction form to correct, and the
  // one thing a form could do from this state is ask for a second account.
  if (phase === "provisioning") {
    return (
      <Screen>
        {header("Naira account", "WITH THE BANK")}
        <View
          className="mt-[30px] bg-canvas-raised border rounded-[20px] p-[20px] overflow-hidden"
          style={{
            borderColor: withAlpha(C.amber, 0.3),
          }}
        >
          <Shine />
          <View className="flex-row items-center gap-[9px]">
            <PulseDot />
            <Display className="text-[18px] leading-[18.9px]">
              {account?.status === "CUSTOMER_CREATED"
                ? "Almost there"
                : "Verifying your details"}
            </Display>
          </View>
          {/* "Nothing needs doing from here" and "this screen is watching" are
              both promises about the poll, so they end when it does. What the
              bank is doing has not changed — only who is asking. */}
          <Body className="text-[12.5px] text-sub mt-[12px] leading-[19px]">
            {account?.status === "CUSTOMER_CREATED"
              ? watching
                ? "You are on the bank's books and your account number is being issued. This screen is watching for it."
                : "You are on the bank's books and your account number is being issued. It is taking longer than usual, so KashPlus has stopped asking on its own — check whenever you want the latest."
              : watching
                ? "The bank is checking your BVN against the name you gave. It usually takes a minute or two, and nothing needs doing from here."
                : "The bank is still checking your BVN against the name you gave. It is taking longer than usual, so KashPlus has stopped asking on its own — check whenever you want the latest."}
          </Body>
          <SectionRule space={16} />
          {/* The cadence is only claimed while it is actually running. The hook
              stops re-asking when this screen is not in front, when the app is
              in the background, and once its window is spent — a label that
              went on saying "every 10 seconds" through any of those would be
              the screen lying about work it is not doing, and "Check now" would
              read as the redundant option rather than the only one left. */}
          <Mono className="text-[10px] text-dim tracking-[1.3px]">
            {watching
              ? "CHECKING EVERY 10 SECONDS"
              : "CHECK WHEN YOU ARE READY"}
          </Mono>
        </View>

        <View className="mt-[22px]">
          <GhostButton label="Check now" onPress={reload} />
        </View>
        <Body className="text-[11.5px] text-dim mt-[18px] leading-[17px]">
          Leaving this screen does not cancel anything — the account keeps
          opening, and the fiat space will show it the moment it is live.
        </Body>
      </Screen>
    );
  }

  if (phase === "provision_failed" && !correcting) {
    return (
      <Screen>
        {header("Naira account", "TURNED DOWN")}
        <View
          className="mt-[30px] border rounded-[20px] p-[20px]"
          style={{
            backgroundColor: withAlpha(C.down, 0.08),
            borderColor: withAlpha(C.down, 0.35),
          }}
        >
          <Display className="text-[18px] leading-[18.9px]">
            The bank could not open this account
          </Display>
          <Body className="text-[12.5px] text-down mt-[12px] leading-[19px]">
            {account?.failureReason ??
              "No reason was given. The usual cause is a name that does not match the one on the BVN."}
          </Body>
        </View>
        <View className="mt-[22px]">
          <MetallicButton
            label="Edit details and try again"
            // Held while the account is being re-read: this control drops the
            // key, and the answer in flight may be the one that says the bank
            // has picked the account up after all.
            disabled={rereading}
            onPress={() => void correctRefusedDetails()}
          />
        </View>
      </Screen>
    );
  }

  if (phase === "disabled") {
    return (
      <Screen>
        {header("Naira account", "DISABLED")}
        <Body className="text-[13px] text-sub mt-[24px] leading-[19px]">
          This account has been switched off. Support can say why and turn it
          back on — opening a second one is not the fix, so this form is closed.
        </Body>
      </Screen>
    );
  }

  // An account the gateway has but this build cannot read. It is the same
  // "you already have one" as `disabled`, and the same answer: the form stays
  // closed. Falling through to it would ask a person who demonstrably holds an
  // account for their BVN again — the exact misreading `unknown_status` was
  // added to prevent.
  if (phase === "unknown_status") {
    return (
      <Screen>
        {header("Naira account", "STATUS NOT RECOGNISED")}
        <Body className="text-[13px] text-sub mt-[24px] leading-[19px]">
          {`Account status: ${accountStatusLabel(account?.status ?? "UNKNOWN")}. You already have an account, and this version of KashPlus does not recognise the state it is in — so this form stays closed. Opening a second one is not the fix.`}
        </Body>
        <View className="mt-[20px]">
          <MetallicButton label="Check again" onPress={reload} />
        </View>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen>
        {header("Naira account", "COULD NOT CHECK")}
        <Body className="text-[13px] text-down mt-[24px] leading-[19px]">
          {accountError ?? "Something went wrong reaching KashPlus."}
        </Body>
        <View className="mt-[20px]">
          <MetallicButton label="Try again" onPress={reload} />
        </View>
      </Screen>
    );
  }

  const show = (key: keyof typeof problems) => (touched ? problems[key] : null);

  return (
    <Screen bottom={80} keyboardShouldPersistTaps="handled">
      {header("Open a naira account", "ONE CHECK · THEN IT IS YOURS")}

      <Body className="text-[12.5px] text-sub mt-[14px] leading-[19px]">
        The bank opens the account in your name, so these have to match the
        details it already holds against your BVN.
      </Body>

      {submitError ? (
        <Pressable
          onPress={() => setSubmitError(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          className="mt-[16px] border rounded-[16px] p-[13px]"
          style={{
            backgroundColor: withAlpha(C.down, 0.1),
            borderColor: withAlpha(C.down, 0.35),
          }}
        >
          <Body className="text-[12px] text-down leading-[17.5px]">
            {submitError}
          </Body>
        </Pressable>
      ) : null}

      {/* The way out of a key the gateway holds under other details. It is a
          button rather than something the catch block does quietly, because
          the reload above may yet show that the earlier request opened an
          account, and dropping the key before that lands is how one person ends
          up with two. So the button is inert until that reload has answered —
          the sentence above is the precondition, and `rereading` is what makes
          it one. It stands on its own copy so dismissing the red panel does not
          take the escape hatch with it. */}
      {conflicted ? (
        <View className="mt-[14px]">
          <Body className="text-[11.5px] text-dim mb-[10px] leading-[17px]">
            {rereading
              ? "KashPlus is checking what that first request actually did before offering to clear it."
              : "KashPlus is still holding the first version of this request. Clear it and your next tap sends these details as a new one."}
          </Body>
          <GhostButton
            label="Start it again"
            disabled={rereading}
            onPress={() => void startOver()}
          />
        </View>
      ) : null}

      <Field
        label="First name"
        value={firstName}
        onChange={setFirstName}
        placeholder="Chidi"
        error={show("firstName")}
      />
      <Field
        label="Surname"
        value={lastName}
        onChange={setLastName}
        placeholder="Okonkwo"
        error={show("lastName")}
      />
      <Field
        label="Phone"
        value={phoneNumber}
        onChange={setPhoneNumber}
        placeholder="08012345678"
        keyboardType="phone-pad"
        autoCapitalize="none"
        maxLength={17}
        mono
        error={show("phoneNumber")}
      />
      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        error={show("email")}
      />
      <Field
        label="BVN"
        value={bvn}
        onChange={(next) => setBvn(next.replace(/\D/g, ""))}
        placeholder="12345678901"
        keyboardType="number-pad"
        maxLength={BVN_LENGTH}
        autoCapitalize="none"
        mono
        error={show("bvn")}
        hint="Sent once to open the account. KashPlus does not store it on this device."
      />

      <View className="mt-[22px] bg-canvas-raised border border-rule rounded-[16px] px-[16px] overflow-hidden">
        <Shine />
        <FixedRow label="COUNTRY" value="Nigeria (NG)" />
        <FixedRow label="CURRENCY" value="Naira (NGN)" last />
      </View>

      <View className="mt-[24px]">
        <MetallicButton
          label="Open my account"
          loading={submitting}
          // Disabled, not `loading`: nothing of the user's is being sent while
          // the account is re-read, and a spinner on this button would say one
          // is. It stays inert until the answer lands, which is what makes
          // "re-read before the next tap can mint a key" true rather than
          // merely intended.
          disabled={rereading || (touched && !complete)}
          onPress={() => void submit()}
        />
      </View>

      <Body className="text-[11px] text-dim mt-[16px] text-center leading-[16.5px]">
        {rereading
          ? "Checking with KashPlus whether an account has already been opened for you — one moment."
          : "Tapping this once is enough. If it times out, KashPlus re-asks about the same request rather than sending a second one."}
      </Body>
    </Screen>
  );
}
