import React, { useState } from "react";
import { View, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  BackHeader,
  MetallicButton,
  GhostButton,
  Card,
  Label,
  Mono,
  Body,
  Display,
  PinDots,
  Keypad,
} from "../components/ui";

// Buy & hold — pick an asset, key in ₦, PIN to buy. Fiat balance funds it.
const PIN_LENGTH = 4;
const FEE = 250;
const available = "₦482,650.00";

type Asset = {
  sym: string;
  name: string;
  price: number;
  priceLabel: string;
  delta: string;
  up: boolean;
};
const assets: Asset[] = [
  {
    sym: "BTC",
    name: "Bitcoin",
    price: 161224000,
    priceLabel: "₦161,224,000",
    delta: "+2.4%",
    up: true,
  },
  {
    sym: "ETH",
    name: "Ethereum",
    price: 5110000,
    priceLabel: "₦5,110,000",
    delta: "+1.1%",
    up: true,
  },
  {
    sym: "SOL",
    name: "Solana",
    price: 219800,
    priceLabel: "₦219,800",
    delta: "-0.8%",
    up: false,
  },
  {
    sym: "USDC",
    name: "USD Coin",
    price: 1590,
    priceLabel: "₦1,590",
    delta: "+0.1%",
    up: true,
  },
];

const withCommas = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
// ₦50,000 of BTC reads "0.00031" — two significant figures, never scientific.
const fmtQty = (q: number) => {
  if (q >= 1) return withCommas(q.toFixed(2));
  const s = q.toPrecision(2);
  return s.includes("e") ? q.toFixed(8) : s;
};

type Step = "asset" | "amount" | "confirm" | "done";

export default function BuyScreen({
  onBack,
  onDone,
}: {
  onBack?: () => void;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<Step>("asset");
  const [asset, setAsset] = useState<Asset>(assets[0]);
  const [digits, setDigits] = useState("");
  const [pin, setPin] = useState("");

  const amt = Number(digits || "0");
  const qty = fmtQty(amt / asset.price);

  const handleAmountKey = (k: string) => {
    if (k === "del") {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (digits.length >= 9) return;
    if (!digits && k === "0") return;
    setDigits(digits + k);
  };

  const handlePinKey = (k: string) => {
    if (k === "del") {
      setPin(pin.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LENGTH) setTimeout(() => setStep("done"), 350);
  };

  if (step === "done") {
    return (
      <View
        style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22 }}
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: C.brandGlow,
              borderWidth: 1,
              borderColor: "rgba(131,190,96,0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg width={34} height={34} viewBox="0 0 24 24">
              <Path
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke={C.brand}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
          <Display size={24} style={{ marginTop: 22 }}>
            Bought and holding
          </Display>
          <Mono size={13} color={C.up} style={{ marginTop: 10 }}>
            {qty} {asset.sym} · ₦{withCommas(digits)}.00
          </Mono>
          <Body
            size={12.5}
            color={C.sub}
            style={{ marginTop: 8, textAlign: "center", lineHeight: 18 }}
          >
            It lands in your crypto holdings — sell anytime.
          </Body>
        </View>
        <View style={{ paddingBottom: 36 }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }

  if (step === "amount") {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View style={{ paddingHorizontal: 22 }}>
          <BackHeader
            title={"Buy " + asset.sym}
            onBack={() => setStep("asset")}
          />
        </View>
        <View style={{ marginTop: 34, alignItems: "center" }}>
          <Body size={11.5} color={C.dim}>
            You're buying
          </Body>
          <Display
            size={44}
            color={digits ? C.text : C.dim}
            style={{ marginTop: 8 }}
          >
            ₦{withCommas(digits || "0")}
          </Display>
          <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
            ≈ {qty} {asset.sym}
          </Mono>
        </View>
        <Body
          size={11}
          color={C.dim}
          style={{ textAlign: "center", marginTop: 14 }}
        >
          Pays from your fiat balance · {available} available
        </Body>
        <View
          style={{
            marginTop: "auto",
            paddingHorizontal: 22,
            paddingBottom: 36,
          }}
        >
          <Keypad onKey={handleAmountKey} />
          <View style={{ marginTop: 16 }}>
            {amt > 0 ? (
              <MetallicButton
                label="Review buy"
                onPress={() => setStep("confirm")}
              />
            ) : (
              <GhostButton label="Enter an amount" height={52} />
            )}
          </View>
        </View>
      </View>
    );
  }

  if (step === "confirm") {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View style={{ paddingHorizontal: 22 }}>
          <BackHeader
            title="Confirm buy"
            onBack={() => {
              setPin("");
              setStep("amount");
            }}
          />
        </View>
        <View style={{ marginTop: 24, alignItems: "center" }}>
          <Body size={11.5} color={C.dim}>
            You're buying
          </Body>
          <Display size={40} style={{ marginTop: 6 }}>
            ₦{withCommas(digits)}
            <Display size={24} color={C.dim}>
              .00
            </Display>
          </Display>
          <Mono size={12} color={C.up} style={{ marginTop: 6 }}>
            ≈ {qty} {asset.sym}
          </Mono>
        </View>
        <Card
          style={{
            marginTop: 18,
            marginHorizontal: 20,
            borderRadius: 16,
            paddingVertical: 4,
            paddingHorizontal: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: C.hairline,
            }}
          >
            <Body size={12.5} color={C.sub}>
              Rate
            </Body>
            <Mono size={12.5} color={C.text}>
              1 {asset.sym} = {asset.priceLabel}
            </Mono>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: C.hairline,
            }}
          >
            <Body size={12.5} color={C.sub}>
              Fee
            </Body>
            <Mono size={12.5} color={C.text}>
              ₦250{" "}
              <Mono size={12.5} color={C.dim}>
                · in quote
              </Mono>
            </Mono>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingVertical: 11,
            }}
          >
            <Body size={12.5} color={C.sub}>
              Total debit
            </Body>
            <Mono
              size={12.5}
              color={C.text}
              style={{ fontFamily: F.monoSemibold }}
            >
              ₦{withCommas(String(amt + FEE))}.00
            </Mono>
          </View>
        </Card>
        <View
          style={{
            marginTop: "auto",
            paddingHorizontal: 22,
            paddingBottom: 36,
          }}
        >
          <Body size={12} color={C.sub} style={{ textAlign: "center" }}>
            Enter PIN to buy
          </Body>
          <View style={{ marginTop: 14, marginBottom: 18 }}>
            <PinDots filled={pin.length} />
          </View>
          <Keypad onKey={handlePinKey} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <BackHeader title="Buy" onBack={onBack} />
        <View style={{ marginTop: 22 }}>
          <Label>Pick an asset</Label>
          {assets.map((a, i) => (
            <Pressable
              key={a.sym}
              onPress={() => {
                setAsset(a);
                setDigits("");
                setPin("");
                setStep("amount");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
                borderBottomWidth: i === assets.length - 1 ? 0 : 1,
                borderBottomColor: C.hairline,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 20,
                  backgroundColor: a.up ? C.upBg : "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mono
                  size={9}
                  color={a.up ? C.up : C.silver}
                  style={{ fontFamily: F.monoSemibold }}
                >
                  {a.sym}
                </Mono>
              </View>
              <View style={{ flex: 1 }}>
                <Body size={13.5} semibold>
                  {a.name}
                </Body>
                <Body size={11} color={C.dim} style={{ marginTop: 2 }}>
                  {a.sym}
                </Body>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Mono size={13} color={C.text}>
                  {a.priceLabel}
                </Mono>
                <Mono
                  size={11}
                  color={a.up ? C.up : C.down}
                  style={{ marginTop: 2 }}
                >
                  {a.delta} · 24h
                </Mono>
              </View>
            </Pressable>
          ))}
        </View>
        <Body
          size={11}
          color={C.dim}
          style={{ textAlign: "center", marginTop: 18 }}
        >
          Pays from your fiat balance · {available} available
        </Body>
      </View>
    </View>
  );
}
