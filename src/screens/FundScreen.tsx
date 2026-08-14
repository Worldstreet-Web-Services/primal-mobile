import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  MetallicButton,
  GhostButton,
  Card,
  Label,
  Mono,
  Body,
  Keypad,
} from "../components/ui";

// Fund wallet — the money-in hub. Three methods, each advancing to its own
// detail step; the header chevron walks back to the list before leaving.
type Step = "list" | "bank" | "card" | "crypto";

const methods: { key: Step; title: string; sub: string }[] = [
  { key: "bank", title: "Bank transfer", sub: "Free · usually under 10s" },
  { key: "card", title: "Card top-up", sub: "Debit card · 1.4% fee" },
  {
    key: "crypto",
    title: "Crypto deposit",
    sub: "Any chain · auto-converts to ₦",
  },
];

const account = {
  bank: "Rubies MFB",
  number: "9012 883 774",
  name: "Denga Kadiri",
};

// Mirrors the ReceiveSheet networks shape — local so the shared mock stays untouched.
const cryptoNetworks = [
  {
    key: "evm",
    label: "EVM",
    addr: "0x7A3fD24b81cE5501a2Fb44C09E4c88A1",
    note: "One address for Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche",
  },
  {
    key: "sol",
    label: "Solana",
    addr: "9xJdW2vNqPh4tR8kFzLm3QbC5sYwQm2P",
    note: "SPL tokens supported",
  },
  {
    key: "trx",
    label: "Tron",
    addr: "TQm4xW8pKvN2dR7hLcE9fBzA3sYw2Kd",
    note: "TRC-20",
  },
  {
    key: "btc",
    label: "Bitcoin",
    addr: "bc1q8w2p4kvn2dr7hlce9fbza3syw2kd94x",
    note: "BTC mainnet",
  },
];

const MAX_DIGITS = 7;
const FEE_RATE = 0.014;

const fmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const truncate = (addr: string) => addr.slice(0, 10) + "…" + addr.slice(-6);

const titles: Record<Step, string> = {
  list: "Fund wallet",
  bank: "Bank transfer",
  card: "Card top-up",
  crypto: "Crypto deposit",
};

function MethodRow({
  title,
  sub,
  onPress,
  last,
}: {
  title: string;
  sub: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View style={{ flex: 1 }}>
        <Body size={13.5} semibold>
          {title}
        </Body>
        <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>
          {sub}
        </Body>
      </View>
      <Text style={{ color: C.dim, fontSize: 18, fontFamily: F.body }}>›</Text>
    </Pressable>
  );
}

export default function FundScreen({
  onBack,
  onOpenReceive,
}: {
  onBack?: () => void;
  onOpenReceive?: () => void;
}) {
  const [step, setStep] = useState<Step>("list");
  const [digits, setDigits] = useState("");
  const [net, setNet] = useState<number | null>(null);

  const back = () => {
    if (step === "list") {
      onBack && onBack();
      return;
    }
    setStep("list");
  };

  const open = (s: Step) => {
    if (s === "card") setDigits("");
    if (s === "crypto") setNet(null);
    setStep(s);
  };

  const handleKey = (k: string) => {
    if (k === "del") {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    if (digits === "" && k === "0") return;
    setDigits(digits + k);
  };

  if (step === "card") {
    const fee = Math.round(parseInt(digits || "0", 10) * FEE_RATE);
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View style={{ paddingHorizontal: 22 }}>
          <BackHeader title={titles.card} onBack={back} />
        </View>
        <View style={{ marginTop: 34, alignItems: "center" }}>
          <Body size={11.5} color={C.dim}>
            Top up with your debit card
          </Body>
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
          <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
            Fee ₦{fmt(String(fee))} · 1.4%
          </Mono>
        </View>
        <View
          style={{
            marginTop: "auto",
            paddingHorizontal: 22,
            paddingBottom: 36,
          }}
        >
          <Keypad onKey={handleKey} />
          <View
            style={{ marginTop: 18, opacity: digits ? 1 : 0.4 }}
            pointerEvents={digits ? "auto" : "none"}
          >
            <MetallicButton label="Continue to card" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <BackHeader title={titles[step]} onBack={back} />
      {step === "list" ? (
        <View style={{ marginTop: 20 }}>
          <Label>Choose a method</Label>
          <Card style={{ marginTop: 10, paddingVertical: 4 }}>
            {methods.map((m, i) => (
              <MethodRow
                key={m.key}
                title={m.title}
                sub={m.sub}
                onPress={() => open(m.key)}
                last={i === methods.length - 1}
              />
            ))}
          </Card>
          <View style={{ marginTop: 16 }}>
            <GhostButton label="Receive QR & details" onPress={onOpenReceive} />
          </View>
          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 14 }}
          >
            Every method lands as Paradigm balance — spend it anywhere in the
            app
          </Body>
        </View>
      ) : null}
      {step === "bank" ? (
        <View style={{ marginTop: 20 }}>
          <Card style={{ paddingVertical: 20 }}>
            <Label>{account.bank}</Label>
            <Mono
              size={28}
              color={C.text}
              style={{
                fontFamily: F.monoSemibold,
                letterSpacing: 2,
                marginTop: 10,
              }}
            >
              {account.number}
            </Mono>
            <Body size={12.5} color={C.dim} style={{ marginTop: 6 }}>
              {account.name}
            </Body>
          </Card>
          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <MetallicButton
                label="Copy number"
                height={48}
                radius={14}
                size={13.5}
              />
            </View>
            <View style={{ flex: 1 }}>
              <GhostButton label="Share details" height={48} />
            </View>
          </View>
          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 14 }}
          >
            Transfers land as Paradigm balance — usually under 10s
          </Body>
        </View>
      ) : null}
      {step === "crypto" ? (
        <View style={{ marginTop: 20 }}>
          <Label>Pick a network</Label>
          <Card style={{ marginTop: 10, paddingVertical: 4 }}>
            {cryptoNetworks.map((n, i) => (
              <Pressable
                key={n.key}
                onPress={() => setNet(i)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  borderBottomWidth: i === cryptoNetworks.length - 1 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Body
                    size={13.5}
                    semibold
                    color={net === i ? C.text : C.silver}
                  >
                    {n.label}
                  </Body>
                  <Body size={11} color={C.dim} style={{ marginTop: 2 }}>
                    {n.note}
                  </Body>
                </View>
                <Text
                  style={{
                    color: net === i ? C.accent : C.dim,
                    fontSize: 18,
                    fontFamily: F.body,
                  }}
                >
                  ›
                </Text>
              </Pressable>
            ))}
          </Card>
          {net !== null ? (
            <View style={{ marginTop: 16 }}>
              <Card style={{ paddingVertical: 18 }}>
                <Label>{cryptoNetworks[net].label} deposit address</Label>
                <Mono
                  size={15}
                  color={C.text}
                  style={{ fontFamily: F.monoSemibold, marginTop: 10 }}
                >
                  {truncate(cryptoNetworks[net].addr)}
                </Mono>
                <View style={{ marginTop: 16 }}>
                  <MetallicButton
                    label="Copy address"
                    height={48}
                    radius={14}
                    size={13.5}
                  />
                </View>
              </Card>
              <Body
                size={11}
                color={C.amber}
                style={{ textAlign: "center", marginTop: 14 }}
              >
                Deposits auto-convert to ₦ via optimistic fill — credited before
                settlement.
              </Body>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
