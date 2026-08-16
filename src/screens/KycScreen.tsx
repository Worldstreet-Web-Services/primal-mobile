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
import {
  PROVISION_SLOT,
  describeLinkpayFailure,
  isAccountUsable,
  provisionAccount,
  releaseIdempotencyKey,
  reserveIdempotencyKey,
} from "../lib/gateway/linkpay";
import {
  NetworkError,
  SessionExpiredError,
  isEntitlementError,
} from "../lib/gateway/types";
import { C, F } from "../theme/tokens";

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
    <View style={{ marginTop: 16 }}>
      <Label>{label}</Label>
      <View
        style={{
          marginTop: 8,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: error ? "rgba(246,165,165,0.45)" : C.hairline,
          borderRadius: 14,
          paddingHorizontal: 14,
          overflow: "hidden",
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
          style={{
            height: 50,
            color: C.text,
            fontFamily: mono ? F.monoSemibold : F.body,
            fontSize: mono ? 15.5 : 14.5,
            letterSpacing: mono ? 1.2 : 0,
          }}
        />
      </View>
      {error ? (
        <Body size={11.5} color={C.down} style={{ marginTop: 7 }}>
          {error}
        </Body>
      ) : hint ? (
        <Body size={11} color={C.dim} style={{ marginTop: 7, lineHeight: 16 }}>
          {hint}
        </Body>
      ) : null}
    </View>
  );
}

/** A fact the user cannot change, shown rather than hidden. */
function FixedRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
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
      <Mono size={10} color={C.dim} style={{ letterSpacing: 1.3 }}>
        {label}
      </Mono>
      <Mono size={12.5} color={C.silver}>
        {value}
      </Mono>
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
  const { phase, account, error: accountError, reload } = useLinkpayAccount();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  // Form state only. Never persisted, never logged, cleared after the send.
  const [bvn, setBvn] = useState("");

  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** The user chose to correct a refused submission — show the form again. */
  const [editing, setEditing] = useState(false);

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
    firstName: firstName.trim().length < 2 ? "Your first name, as your bank has it." : null,
    lastName: lastName.trim().length < 2 ? "Your surname, as your bank has it." : null,
    phoneNumber: validPhone(phoneNumber) ? null : "An 11-digit Nigerian number, e.g. 08012345678.",
    email: EMAIL_PATTERN.test(email.trim()) ? null : "An email address the bank can reach you on.",
    bvn:
      bvn.replace(/\D/g, "").length === BVN_LENGTH ? null : `Your BVN is ${BVN_LENGTH} digits.`,
  };
  const complete = Object.values(problems).every((p) => p === null);

  const submit = async () => {
    setTouched(true);
    if (!complete || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

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
      setEditing(false);

      if (isAccountUsable(next.status)) {
        // Terminal success — the key has done its job and must not be reused.
        await releaseIdempotencyKey(PROVISION_SLOT);
      }
      // PENDING_KYC / CUSTOMER_CREATED keep the key: they are the middle of
      // this operation, not the end of it, and a retry has to carry it.
      reload();
    } catch (err) {
      if (SessionExpiredError.is(err)) return;
      if (isEntitlementError(err)) {
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
      setSubmitError(describeLinkpayFailure(err));
    } finally {
      setSubmitting(false);
    }
  };

  /** Correct refused details: drop the spent key so the fix is a new attempt. */
  const editAfterFailure = async () => {
    // PROVISION_FAILED is terminal for that key — replaying it would replay the
    // refusal. This is the one place a key is legitimately dropped and reminted.
    await releaseIdempotencyKey(PROVISION_SLOT);
    setSubmitError(null);
    setEditing(true);
  };

  const header = (title: string, sub: string) => (
    <View>
      <BackHeader title={title} onBack={onBack} />
      <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.4, marginTop: 2 }}>
        {sub}
      </Mono>
    </View>
  );

  if (phase === "loading") {
    return (
      <Screen>
        {header("Naira account", "CHECKING WHERE YOU ARE")}
        <View style={{ marginTop: 60, alignItems: "center" }}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  if (phase === "signed_out") {
    return (
      <Screen>
        {header("Naira account", "SIGN IN FIRST")}
        <Body size={13} color={C.sub} style={{ marginTop: 24, lineHeight: 19 }}>
          Sign in to Paradigm and this account opens against your own identity.
        </Body>
        <View style={{ marginTop: 20 }}>
          <MetallicButton label="Sign in" onPress={onNeedsSignIn} />
        </View>
      </Screen>
    );
  }

  if (phase === "unentitled") {
    return (
      <Screen>
        {header("Naira account", "SUBSCRIPTION REQUIRED")}
        <Body size={13} color={C.sub} style={{ marginTop: 24, lineHeight: 19 }}>
          A naira account is part of a Paradigm subscription. Nothing is wrong with your sign-in —
          the subscription is what is missing.
        </Body>
        <View style={{ marginTop: 20 }}>
          <MetallicButton label="See the plan" onPress={onNeedsSubscription} />
        </View>
      </Screen>
    );
  }

  if (phase === "ready") {
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
          <Check />
        </View>
        <Display size={23} style={{ marginTop: 20, textAlign: "center" }}>
          Your account is open
        </Display>
        {account?.accountNumber ? (
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 26,
              letterSpacing: 2.5,
              color: C.text,
              marginTop: 16,
            }}
          >
            {account.accountNumber}
          </Text>
        ) : null}
        <Body size={12.5} color={C.sub} style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}>
          {account?.bankName ? `${account.bankName} · ` : ""}
          {account?.accountName ?? "In your name"}
        </Body>
        <View style={{ marginTop: 30, alignSelf: "stretch" }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  if (phase === "provisioning" && !editing) {
    return (
      <Screen>
        {header("Naira account", "WITH THE BANK")}
        <View
          style={{
            marginTop: 30,
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: "rgba(245,184,61,0.3)",
            borderRadius: 20,
            padding: 20,
            overflow: "hidden",
          }}
        >
          <Shine />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <PulseDot />
            <Display size={18}>
              {account?.status === "CUSTOMER_CREATED" ? "Almost there" : "Verifying your details"}
            </Display>
          </View>
          <Body size={12.5} color={C.sub} style={{ marginTop: 12, lineHeight: 19 }}>
            {account?.status === "CUSTOMER_CREATED"
              ? "You are on the bank's books and your account number is being issued. This screen is watching for it."
              : "The bank is checking your BVN against the name you gave. It usually takes a minute or two, and nothing needs doing from here."}
          </Body>
          <SectionRule space={16} />
          <Mono size={10} color={C.dim} style={{ letterSpacing: 1.3 }}>
            CHECKING EVERY 10 SECONDS
          </Mono>
        </View>

        <View style={{ marginTop: 22 }}>
          <GhostButton label="Check now" onPress={reload} />
        </View>
        <Body size={11.5} color={C.dim} style={{ marginTop: 18, lineHeight: 17 }}>
          Leaving this screen does not cancel anything — the account keeps opening, and the fiat
          space will show it the moment it is live.
        </Body>
      </Screen>
    );
  }

  if (phase === "provision_failed" && !editing) {
    return (
      <Screen>
        {header("Naira account", "TURNED DOWN")}
        <View
          style={{
            marginTop: 30,
            backgroundColor: "rgba(246,165,165,0.08)",
            borderWidth: 1,
            borderColor: "rgba(246,165,165,0.35)",
            borderRadius: 20,
            padding: 20,
          }}
        >
          <Display size={18}>The bank could not open this account</Display>
          <Body size={12.5} color={C.down} style={{ marginTop: 12, lineHeight: 19 }}>
            {account?.failureReason ??
              "No reason was given. The usual cause is a name that does not match the one on the BVN."}
          </Body>
        </View>
        <View style={{ marginTop: 22 }}>
          <MetallicButton label="Edit details and try again" onPress={() => void editAfterFailure()} />
        </View>
      </Screen>
    );
  }

  if (phase === "disabled") {
    return (
      <Screen>
        {header("Naira account", "DISABLED")}
        <Body size={13} color={C.sub} style={{ marginTop: 24, lineHeight: 19 }}>
          This account has been switched off. Support can say why and turn it back on — opening a
          second one is not the fix, so this form is closed.
        </Body>
      </Screen>
    );
  }

  if (phase === "error") {
    return (
      <Screen>
        {header("Naira account", "COULD NOT CHECK")}
        <Body size={13} color={C.down} style={{ marginTop: 24, lineHeight: 19 }}>
          {accountError ?? "Something went wrong reaching Paradigm."}
        </Body>
        <View style={{ marginTop: 20 }}>
          <MetallicButton label="Try again" onPress={reload} />
        </View>
      </Screen>
    );
  }

  const show = (key: keyof typeof problems) => (touched ? problems[key] : null);

  return (
    <Screen bottom={80} keyboardShouldPersistTaps="handled">
      {header("Open a naira account", "ONE CHECK · THEN IT IS YOURS")}

      <Body size={12.5} color={C.sub} style={{ marginTop: 14, lineHeight: 19 }}>
        The bank opens the account in your name, so these have to match the details it already
        holds against your BVN.
      </Body>

      {submitError ? (
        <Pressable
          onPress={() => setSubmitError(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{
            marginTop: 16,
            backgroundColor: "rgba(246,165,165,0.1)",
            borderWidth: 1,
            borderColor: "rgba(246,165,165,0.35)",
            borderRadius: 16,
            padding: 13,
          }}
        >
          <Body size={12} color={C.down} style={{ lineHeight: 17.5 }}>
            {submitError}
          </Body>
        </Pressable>
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
        hint="Sent once to open the account. Paradigm does not store it on this device."
      />

      <View
        style={{
          marginTop: 22,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          borderRadius: 16,
          paddingHorizontal: 16,
          overflow: "hidden",
        }}
      >
        <Shine />
        <FixedRow label="COUNTRY" value="Nigeria (NG)" />
        <FixedRow label="CURRENCY" value="Naira (NGN)" last />
      </View>

      <View style={{ marginTop: 24 }}>
        <MetallicButton
          label="Open my account"
          loading={submitting}
          disabled={touched && !complete}
          onPress={() => void submit()}
        />
      </View>

      <Body size={11} color={C.dim} style={{ marginTop: 16, textAlign: "center", lineHeight: 16.5 }}>
        Tapping this once is enough. If it times out, Paradigm re-asks about the same request rather
        than sending a second one.
      </Body>
    </Screen>
  );
}
