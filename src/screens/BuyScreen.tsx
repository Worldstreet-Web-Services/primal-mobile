import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "../theme/tokens";
import {
  BackHeader,
  MetallicButton,
  GhostButton,
  Label,
  Mono,
  Body,
  Display,
  PinDots,
  Keypad,
} from "../components/ui";
import {
  InstrumentRow,
  MetaChip,
  QuoteCard,
  QuoteRow,
  SectionHead,
  Settle,
} from "../components/crypto";

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
  /** Dollar-pegged — the disc carries `up`, as on every other crypto list. */
  stable?: boolean;
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
    stable: true,
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
          <Settle distance={14}>
            <View style={{ alignItems: "center" }}>
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
              <Display size={26} style={{ marginTop: 24 }}>
                Bought and holding
              </Display>
              <Mono size={13.5} color={C.up} style={{ marginTop: 12 }}>
                {qty} {asset.sym} · ₦{withCommas(digits)}.00
              </Mono>
              <Body
                size={12.5}
                color={C.dim}
                style={{ marginTop: 10, textAlign: "center", lineHeight: 18 }}
              >
                It lands in your crypto holdings. Sell anytime.
              </Body>
            </View>
          </Settle>
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
        <View style={{ flex: 1, justifyContent: "center" }}>
          <View style={{ alignItems: "center" }}>
            <Label>Buying</Label>
            <Display
              size={44}
              color={digits ? C.text : C.dim}
              style={{ marginTop: 12 }}
            >
              ₦{withCommas(digits || "0")}
            </Display>
            <Mono size={12.5} color={C.sub} style={{ marginTop: 10 }}>
              ≈ {qty} {asset.sym}
            </Mono>
            <View style={{ marginTop: 14 }}>
              <MetaChip label={`1 ${asset.sym} = ${asset.priceLabel}`} />
            </View>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 22,
            paddingBottom: 36,
          }}
        >
          <Mono size={11.5} color={C.dim} style={{ marginBottom: 14 }}>
            Pays from fiat · {available}
          </Mono>
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
        <Settle>
          <View style={{ marginTop: 26, alignItems: "center" }}>
            <Label>Buying</Label>
            <Display size={40} style={{ marginTop: 10 }}>
              ₦{withCommas(digits)}
              <Display size={24} color={C.dim}>
                .00
              </Display>
            </Display>
            <Mono size={12.5} color={C.sub} style={{ marginTop: 8 }}>
              ≈ {qty} {asset.sym}
            </Mono>
          </View>
          <QuoteCard style={{ marginTop: 22, marginHorizontal: 22 }}>
            <QuoteRow label="Asset" value={`${asset.name} · ${asset.sym}`} />
            <QuoteRow
              label="Rate"
              value={`1 ${asset.sym} = ${asset.priceLabel}`}
            />
            <QuoteRow label="Fee" value="₦250" tail="· in quote" />
            <QuoteRow
              label="Total debit"
              value={`₦${withCommas(String(amt + FEE))}.00`}
              strong
              last
            />
          </QuoteCard>
        </Settle>
        <View
          style={{
            marginTop: "auto",
            paddingHorizontal: 22,
            paddingBottom: 36,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Label>Enter PIN to buy</Label>
          </View>
          <View style={{ marginTop: 16, marginBottom: 20 }}>
            <PinDots filled={pin.length} />
          </View>
          <Keypad onKey={handlePinKey} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ flex: 1, paddingHorizontal: 22 }}>
        <BackHeader title="Buy" onBack={onBack} />
        <View style={{ marginTop: 24 }}>
          <SectionHead
            label="Pick an asset"
            right={
              <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.3 }}>
                PRICE · 24H
              </Mono>
            }
          />
          <View style={{ marginTop: 2 }}>
            {assets.map((a, i) => (
              <InstrumentRow
                key={a.sym}
                symbol={a.sym}
                name={a.name}
                sub={a.sym}
                value={a.priceLabel}
                meta={`${a.delta} · 24h`}
                metaTone={a.up ? "up" : "down"}
                stable={a.stable}
                last={i === assets.length - 1}
                accessibilityLabel={`Buy ${a.name}`}
                onPress={() => {
                  setAsset(a);
                  setDigits("");
                  setPin("");
                  setStep("amount");
                }}
              />
            ))}
          </View>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ alignItems: "center", gap: 12, paddingBottom: 34 }}>
          <Body size={11.5} color={C.dim} style={{ textAlign: "center" }}>
            Bought assets settle into your crypto holdings.
          </Body>
          <MetaChip label={`Fiat balance · ${available}`} />
        </View>
      </View>
    </View>
  );
}
