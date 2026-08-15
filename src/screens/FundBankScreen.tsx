import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  MetallicButton,
  Card,
  Label,
  Mono,
  Body,
  Display,
  Keypad,
  PulseDot,
} from "../components/ui";

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

const fmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function CopyRow({
  label,
  value,
  big,
  copied,
  onPress,
  last,
}: {
  label: string;
  value: string;
  big?: boolean;
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
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <Body size={12} color={C.dim}>
        {label}
      </Body>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Mono
          size={big ? 17 : 12.5}
          color={C.text}
          style={
            big ? { fontFamily: F.monoSemibold, letterSpacing: 1.5 } : undefined
          }
        >
          {value}
        </Mono>
        <Mono size={9.5} color={copied ? C.up : C.dim}>
          {copied ? "✓" : "COPY"}
        </Mono>
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
  const [copied, setCopied] = useState<string | null>(null);

  const amount = parseInt(digits || "0", 10);
  const valid = amount >= MIN_NGN;

  // One clock for the countdown, one poll for the "checked Ns ago" line,
  // and the simulated settle — all scoped to the account step.
  useEffect(() => {
    if (step !== "account") return;
    setPhase("waiting");
    setLastChecked(Date.now());
    setNow(Date.now());
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
  }, [step]);

  // Expiry: an unpaid account past its window goes back to the amount
  // step with a fresh-account nudge, never a dead screen.
  useEffect(() => {
    if (step !== "account" || !account || phase !== "waiting") return;
    if (now >= account.expiresAt) {
      setError(
        "This account expired before your transfer arrived. Start over to get a fresh one.",
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

  const copy = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
    } catch {}
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1_600);
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
        ? `Enter at least ₦${fmt(String(MIN_NGN))} to continue`
        : !valid
          ? `The minimum is ₦${fmt(String(MIN_NGN))}`
          : "You'll get a one-off account for exactly this amount";
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View style={{ paddingHorizontal: 22 }}>
          <BackHeader title="Bank transfer" onBack={onBack} />
          <Body size={12} color={C.dim} style={{ marginTop: 6 }}>
            Fund in naira from any Nigerian bank or app.
          </Body>
          {error ? (
            <Pressable
              onPress={() => setError(null)}
              style={{
                marginTop: 12,
                backgroundColor: "rgba(246,165,165,0.1)",
                borderWidth: 1,
                borderColor: "rgba(246,165,165,0.35)",
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Body size={12} color={C.down} style={{ lineHeight: 17 }}>
                {error}
              </Body>
            </Pressable>
          ) : null}
        </View>
        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Label>You add</Label>
          <Text
            style={{
              fontFamily: F.display,
              fontSize: 46,
              lineHeight: 48,
              marginTop: 8,
              color: digits ? C.text : C.dim,
            }}
          >
            ₦{fmt(digits || "0")}
          </Text>
          <Mono size={11.5} color={hintColor} style={{ marginTop: 10 }}>
            {hint}
          </Mono>
          <Body size={11} color={C.dim} style={{ marginTop: 6 }}>
            Verified as @dave · no fees on bank transfers
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
              label={busy ? "Setting up…" : "Get account number"}
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
          Transfer the exact amount from any Nigerian bank or app. Send only
          once — your balance credits automatically when it clears.
        </Body>

        <Card
          style={{
            marginTop: 16,
            alignItems: "center",
            paddingVertical: 18,
            backgroundColor: C.brandGlow,
            borderColor: "rgba(221,179,90,0.35)",
          }}
        >
          <Label>Send exactly</Label>
          <Pressable onPress={() => void copy("amount", String(amount))}>
            <Display size={34} style={{ marginTop: 8 }}>
              ₦{fmt(digits)}
            </Display>
          </Pressable>
          <Mono
            size={10}
            color={copied === "amount" ? C.up : C.dim}
            style={{ marginTop: 6 }}
          >
            {copied === "amount" ? "✓ COPIED" : "TAP TO COPY"}
          </Mono>
        </Card>

        <View
          style={{
            marginTop: 10,
            backgroundColor: "rgba(245,184,61,0.1)",
            borderWidth: 1,
            borderColor: "rgba(245,184,61,0.35)",
            borderRadius: 14,
            padding: 13,
          }}
        >
          <Body size={11.5} color={C.amber} style={{ lineHeight: 17 }}>
            Send this exact amount, in one transfer. A different amount — or
            two smaller ones — may be delayed or returned instead of credited.
          </Body>
        </View>

        <Card style={{ marginTop: 12, paddingVertical: 4 }}>
          <CopyRow
            label="Bank"
            value={account.bank}
            copied={copied === "Bank"}
            onPress={() => void copy("Bank", account.bank)}
          />
          <CopyRow
            label="Account number"
            value={account.number}
            big
            copied={copied === "Account number"}
            onPress={() =>
              void copy("Account number", account.number.replace(/ /g, ""))
            }
          />
          <CopyRow
            label="Account name"
            value={account.name}
            copied={copied === "Account name"}
            onPress={() => void copy("Account name", account.name)}
          />
          <CopyRow
            label="Reference"
            value={account.reference}
            copied={copied === "Reference"}
            onPress={() => void copy("Reference", account.reference)}
            last
          />
        </Card>

        <View
          style={{
            marginTop: 18,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
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
          <Body size={12.5} color={C.sub}>
            {processing
              ? "Transfer received — crediting your balance…"
              : "Waiting for your transfer…"}
          </Body>
          {!processing ? (
            <Mono size={12} color={C.amber}>
              {mm}:{ss}
            </Mono>
          ) : null}
        </View>
        <Body
          size={10.5}
          color={C.dim}
          style={{ textAlign: "center", marginTop: 8 }}
        >
          Transfers usually credit in under a minute
          {checkedAgo !== null ? ` · checked ${checkedAgo}s ago` : ""}
        </Body>

        <Pressable
          onPress={startOver}
          style={{ marginTop: 18, alignItems: "center", paddingVertical: 8 }}
        >
          <Body size={12} color={C.dim}>
            Start over
          </Body>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen center>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: C.upBg,
          borderWidth: 1,
          borderColor: "rgba(124,231,176,0.35)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: C.up, fontSize: 26 }}>✓</Text>
      </View>
      <Display size={24} style={{ marginTop: 18 }}>
        Funds received
      </Display>
      <Body
        size={13}
        color={C.sub}
        style={{ marginTop: 8, textAlign: "center", lineHeight: 19 }}
      >
        ₦{fmt(digits || "0")} landed in your Paradigm balance.
      </Body>
      <View style={{ marginTop: 26, alignSelf: "stretch" }}>
        <MetallicButton label="Done" onPress={onDone} />
      </View>
    </Screen>
  );
}
