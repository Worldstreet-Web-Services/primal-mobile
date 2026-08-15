import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  MetallicButton,
  Label,
  Mono,
  Body,
  Display,
  Keypad,
  PressableScale,
  PulseDot,
  Shine,
} from "../components/ui";
import { CopyMark, useCopy } from "../components/CopyAction";

// Bank-transfer funding, modeled on Ark's fundbank flow: pick an amount,
// get a one-off account that exists for exactly this transfer, send the
// exact figure, watch it settle. The KYC leg is skipped — the mock user
// is already verified — but the money mechanics carry over whole:
// exact-amount discipline, copy-everything rows, an expiry countdown,
// and a settle poll that narrates the middle instead of going quiet.

type Step = "amount" | "account" | "done";

type OneOffAccount = {
  bank: string;
  number: string;
  name: string;
  reference: string;
  expiresAt: number;
};

const MIN_NGN = 1000;
const MAX_DIGITS = 8;
/** How long the one-off account stays payable. */
const EXPIRY_MS = 30 * 60 * 1000;
/** Simulated settle: the transfer is "seen" first, then credits. */
const SETTLE_SEEN_MS = 14_000;
const SETTLE_DONE_MS = 20_000;
/** Simulated status-poll cadence — drives the "checked Ns ago" line. */
const POLL_MS = 8_000;
/** Below this the countdown stops being background and starts being a fact. */
const URGENT_MS = 60_000;

/** Standing amounts, so the common case is one tap instead of five. */
const PRESETS = [5_000, 10_000, 50_000, 100_000];

const fmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const compact = (n: number) => (n >= 1000 ? `${n / 1000}K` : String(n));

function CheckSeal() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={C.up}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** A quiet detail line under the account card — copyable, but not shouting. */
function DetailRow({
  label,
  value,
  copied,
  onPress,
  last,
}: {
  label: string;
  value: string;
  copied: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={"Copy " + label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <Mono size={10} color={C.dim} style={{ letterSpacing: 1.3 }}>
        {label.toUpperCase()}
      </Mono>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flexShrink: 1,
        }}
      >
        <Mono size={12.5} color={C.text}>
          {value}
        </Mono>
        <CopyMark copied={copied} />
      </View>
    </Pressable>
  );
}

export default function FundBankScreen({
  onBack,
  onDone,
}: {
  onBack?: () => void;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<Step>("amount");
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<OneOffAccount | null>(null);
  /** What the "provider" last said: waiting, then transfer seen. */
  const [phase, setPhase] = useState<"waiting" | "processing">("waiting");
  const [now, setNow] = useState(() => Date.now());
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const { copied, copy } = useCopy();

  // The account card is placed, not rendered: it rises and settles once, the
  // way a teller slides a card across the counter. The one motion moment here.
  const place = useRef(new Animated.Value(0)).current;

  const amount = parseInt(digits || "0", 10);
  const valid = amount >= MIN_NGN;

  // One clock for the countdown, one poll for the "checked Ns ago" line,
  // and the simulated settle — all scoped to the account step.
  useEffect(() => {
    if (step !== "account") return;
    setPhase("waiting");
    setLastChecked(Date.now());
    setNow(Date.now());
    place.setValue(0);
    Animated.spring(place, {
      toValue: 1,
      useNativeDriver: true,
      speed: 11,
      bounciness: 5,
    }).start();
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    const poll = setInterval(() => setLastChecked(Date.now()), POLL_MS);
    const seen = setTimeout(() => setPhase("processing"), SETTLE_SEEN_MS);
    const done = setTimeout(() => setStep("done"), SETTLE_DONE_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
      clearTimeout(seen);
      clearTimeout(done);
    };
  }, [step, place]);

  // Expiry: an unpaid account past its window goes back to the amount
  // step with a fresh-account nudge, never a dead screen.
  useEffect(() => {
    if (step !== "account" || !account || phase !== "waiting") return;
    if (now >= account.expiresAt) {
      setError(
        "That account expired before your transfer arrived. Start again for a fresh one.",
      );
      setAccount(null);
      setStep("amount");
    }
  }, [now, step, account, phase]);

  const handleKey = (k: string) => {
    if (k === "del") {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    if (digits === "" && k === "0") return;
    setDigits(digits + k);
  };

  const getAccount = () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setTimeout(() => {
      setAccount({
        bank: "Wema Bank",
        number: "7810 442 953",
        name: "Paradigm — Dave Kadiri",
        reference: "PAR-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        expiresAt: Date.now() + EXPIRY_MS,
      });
      setBusy(false);
      setStep("account");
    }, 900);
  };

  const startOver = () => {
    setAccount(null);
    setDigits("");
    setError(null);
    setStep("amount");
  };

  if (step === "amount") {
    const hintColor = digits === "" ? C.dim : !valid ? C.amber : C.sub;
    const hint =
      digits === ""
        ? `MINIMUM ₦${fmt(String(MIN_NGN))}`
        : !valid
          ? `BELOW THE ₦${fmt(String(MIN_NGN))} MINIMUM`
          : "ONE ACCOUNT, ISSUED FOR THIS AMOUNT";
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View style={{ paddingHorizontal: 22 }}>
          <BackHeader title="Bank transfer" onBack={onBack} />
          <Body size={12.5} color={C.sub} style={{ marginTop: 6 }}>
            Naira in, from any Nigerian bank or app.
          </Body>
          {error ? (
            <Pressable
              onPress={() => setError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={{
                marginTop: 14,
                backgroundColor: "rgba(246,165,165,0.1)",
                borderWidth: 1,
                borderColor: "rgba(246,165,165,0.35)",
                borderRadius: 16,
                padding: 13,
              }}
            >
              <Body size={12} color={C.down} style={{ lineHeight: 17.5 }}>
                {error}
              </Body>
            </Pressable>
          ) : null}
        </View>

        <View style={{ marginTop: 26, paddingHorizontal: 22 }}>
          <View
            style={{
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 22,
              paddingVertical: 22,
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <Shine />
            <Label>You add</Label>
            <Text
              style={{
                fontFamily: F.display,
                fontSize: 44,
                lineHeight: 50,
                marginTop: 10,
                color: digits ? C.text : C.dim,
              }}
            >
              ₦{fmt(digits || "0")}
            </Text>
            <Mono
              size={10}
              color={hintColor}
              style={{ marginTop: 10, letterSpacing: 1.3 }}
            >
              {hint}
            </Mono>
          </View>

          {/* Standing amounts. Ark's bank leg makes you type every figure;
              the web build offers these, and at this size most transfers are
              one of four round numbers. */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            {PRESETS.map((p) => {
              const on = digits === String(p);
              return (
                <Pressable
                  key={p}
                  onPress={() => setDigits(String(p))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 99,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: on ? C.brandSoft : C.border,
                    backgroundColor: on ? C.brandGlow : C.card,
                  }}
                >
                  <Mono size={11.5} color={on ? C.brandSoft : C.silver}>
                    ₦{compact(p)}
                  </Mono>
                </Pressable>
              );
            })}
          </View>

          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 16 }}
          >
            Verified as @dave · no fee on bank transfers
          </Body>
        </View>

        <View
          style={{ marginTop: "auto", paddingHorizontal: 22, paddingBottom: 36 }}
        >
          <Keypad onKey={handleKey} />
          <View
            style={{ marginTop: 18, opacity: valid ? 1 : 0.4 }}
            pointerEvents={valid && !busy ? "auto" : "none"}
          >
            <MetallicButton
              label={busy ? "Issuing…" : "Get account number"}
              onPress={getAccount}
            />
          </View>
        </View>
      </View>
    );
  }

  if (step === "account" && account) {
    const expiresIn = Math.max(0, account.expiresAt - now);
    const mm = Math.floor(expiresIn / 60_000);
    const ss = String(Math.floor((expiresIn % 60_000) / 1000)).padStart(2, "0");
    const urgent = expiresIn <= URGENT_MS;
    const checkedAgo =
      lastChecked === null
        ? null
        : Math.max(0, Math.round((now - lastChecked) / 1000));
    const processing = phase === "processing";
    return (
      <Screen>
        <BackHeader
          title="Complete your transfer"
          onBack={() => setStep("amount")}
        />
        <Body size={12.5} color={C.sub} style={{ marginTop: 8, lineHeight: 18 }}>
          Send the exact amount, once, from any Nigerian bank or app.
        </Body>

        {/* The account is one object, not a form: the figure to send, the
            number to send it to, and who it belongs to, on a single plate.
            Splitting them across four equal rows is what made the crown
            jewel read like a table cell. */}
        <Animated.View
          style={{
            marginTop: 18,
            opacity: place,
            transform: [
              {
                translateY: place.interpolate({
                  inputRange: [0, 1],
                  outputRange: [22, 0],
                }),
              },
              {
                scale: place.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                }),
              },
            ],
          }}
        >
          <View
            style={{
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            <Shine />

            {/* Header band: the exact figure, and how long it stays payable. */}
            <View
              style={{
                paddingHorizontal: 18,
                paddingTop: 16,
                paddingBottom: 14,
                backgroundColor: C.brandGlow,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(131,190,96,0.28)",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Label style={{ color: C.brandSoft }}>Send exactly</Label>
                {!processing ? (
                  <Mono
                    size={11.5}
                    color={urgent ? C.down : C.dim}
                    style={{ letterSpacing: 1 }}
                  >
                    EXPIRES {mm}:{ss}
                  </Mono>
                ) : null}
              </View>
              <PressableScale
                onPress={() => void copy("amount", String(amount))}
                scale={0.985}
              >
                <View
                  accessibilityRole="button"
                  accessibilityLabel="Copy amount"
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginTop: 6,
                  }}
                >
                  <Display size={34}>₦{fmt(digits)}</Display>
                  <View style={{ paddingBottom: 6 }}>
                    <CopyMark copied={copied === "amount"} />
                  </View>
                </View>
              </PressableScale>
            </View>

            {/* The number itself — the one figure this whole screen exists
                to hand over. */}
            <PressableScale
              onPress={() =>
                void copy("number", account.number.replace(/ /g, ""))
              }
              scale={0.99}
            >
              <View
                accessibilityRole="button"
                accessibilityLabel="Copy account number"
                style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 }}
              >
                <Label>Account number</Label>
                <Text
                  style={{
                    fontFamily: F.monoSemibold,
                    fontSize: 27,
                    lineHeight: 34,
                    letterSpacing: 2.5,
                    color: C.text,
                    marginTop: 9,
                  }}
                >
                  {account.number}
                </Text>
                <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
                  <CopyMark copied={copied === "number"} label="COPY NUMBER" />
                </View>
              </View>
            </PressableScale>

            {/* Everything else the transfer needs, demoted but still one tap
                from the clipboard — the references make all four copyable and
                people do reach for the reference. */}
            <View
              style={{
                paddingHorizontal: 18,
                borderTopWidth: 1,
                borderTopColor: C.hairline,
              }}
            >
              <DetailRow
                label="Bank"
                value={account.bank}
                copied={copied === "bank"}
                onPress={() => void copy("bank", account.bank)}
              />
              <DetailRow
                label="Account name"
                value={account.name}
                copied={copied === "name"}
                onPress={() => void copy("name", account.name)}
              />
              <DetailRow
                label="Reference"
                value={account.reference}
                copied={copied === "ref"}
                onPress={() => void copy("ref", account.reference)}
                last
              />
            </View>
          </View>
        </Animated.View>

        <Body
          size={11.5}
          color={C.dim}
          style={{ marginTop: 14, lineHeight: 17.5 }}
        >
          One transfer, this exact figure. A different amount — or two smaller
          ones — may be returned rather than credited.
        </Body>

        <View
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTopWidth: 1,
            borderTopColor: C.hairline,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
            }}
          >
            {processing ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: C.up,
                }}
              />
            ) : (
              <PulseDot />
            )}
            <Body size={13} color={processing ? C.up : C.silver}>
              {processing
                ? "Transfer received — crediting now"
                : "Watching for your transfer"}
            </Body>
          </View>
          <Mono
            size={10}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 8, letterSpacing: 1.2 }}
          >
            {checkedAgo === null
              ? "STANDING BY"
              : `CHECKED ${checkedAgo}S AGO · USUALLY UNDER A MINUTE`}
          </Mono>
        </View>

        <Pressable
          onPress={startOver}
          accessibilityRole="button"
          style={{ marginTop: 20, alignItems: "center", paddingVertical: 8 }}
        >
          <Body size={12} color={C.dim}>
            Start again
          </Body>
        </Pressable>
      </Screen>
    );
  }

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
        <CheckSeal />
      </View>
      <Display size={23} style={{ marginTop: 20 }}>
        Wired to your name
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
        ₦{fmt(digits || "0")}
      </Text>
      <Body
        size={12.5}
        color={C.sub}
        style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}
      >
        Settled into your Paradigm balance.{"\n"}Spend it anywhere in the app.
      </Body>
      <View style={{ marginTop: 30, alignSelf: "stretch" }}>
        <MetallicButton label="Done" onPress={onDone} />
      </View>
    </Screen>
  );
}
