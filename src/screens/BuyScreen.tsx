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
import { useFiatOverview } from "../hooks/useLinkpay";
import { formatMoney } from "../lib/gateway/money";
import { cn } from "@/lib/cn";

// Buy & hold — pick an asset, key in ₦, PIN to buy. Fiat balance funds it.
const PIN_LENGTH = 4;
const FEE = 250;

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

  // The spending balance, from the gateway — the same read FiatSpaceScreen and
  // FundBankScreen make. It replaces a hardcoded "₦482,650.00" that was shown
  // flatly as this user's money, on the screen where they decide how much of it
  // to spend. `balance` is only ever set from a `ready` account, so a null here
  // is an honest "we have not been told", and the labels below say that rather
  // than filling the gap.
  const { balance } = useFiatOverview();
  const availableLabel = balance?.available
    ? formatMoney(balance.available)
    : null;

  const amt = Number(digits || "0");
  const qty = fmtQty(amt / asset.price);
  /** Nothing keyed yet — the ₦0 on screen is scaffolding, not an amount. */
  const noAmount = digits === "";

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
      <View className="flex-1 bg-canvas px-[22px]">
        <View className="flex-1 items-center justify-center">
          <Settle distance={14}>
            <View className="items-center">
              <View
                className="w-[76px] h-[76px] rounded-[38px] bg-brand-glow border items-center justify-center"
                style={{
                  borderColor: "rgba(131,190,96,0.35)",
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
              <Display className="text-[26px] leading-[27.3px] mt-[24px]">
                Bought and holding
              </Display>
              <Mono className="text-[13.5px] text-up mt-[12px]">
                {qty} {asset.sym} · ₦{withCommas(digits)}.00
              </Mono>
              <Body className="text-[12.5px] text-dim mt-[10px] text-center leading-[18px]">
                It lands in your crypto holdings. Sell anytime.
              </Body>
            </View>
          </Settle>
        </View>
        <View className="pb-[36px]">
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }

  if (step === "amount") {
    return (
      <View className="flex-1 bg-canvas">
        <View className="px-[22px]">
          <BackHeader
            title={"Buy " + asset.sym}
            onBack={() => setStep("asset")}
          />
        </View>
        <View className="flex-1 justify-center">
          <View className="items-center">
            <Label>Buying</Label>
            <Display
              size={44}

              className={cn(
                "mt-[12px]",
                noAmount ? "text-placeholder" : "text-text",
              )}
            >
              ₦{withCommas(digits || "0")}
            </Display>
            {noAmount ? (
              // Carries the meaning the ghost figure above deliberately cannot,
              // and replaces an "≈ 0.00 BTC" that was a quote for nothing.
              <Body className="text-[12.5px] text-sub mt-[10px]">
                Enter an amount to buy
              </Body>
            ) : (
              <Mono className="text-[12.5px] text-sub mt-[10px]">
                ≈ {qty} {asset.sym}
              </Mono>
            )}
            <View className="mt-[14px]">
              <MetaChip label={`1 ${asset.sym} = ${asset.priceLabel}`} />
            </View>
          </View>
        </View>
        <View className="px-[22px] pb-[36px]">
          <Mono className="text-[11.5px] text-dim mb-[14px]">
            {availableLabel
              ? `Pays from fiat · ${availableLabel}`
              : "Pays from your fiat balance"}
          </Mono>
          <Keypad onKey={handleAmountKey} />
          <View className="mt-[16px]">
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
      <View className="flex-1 bg-canvas">
        <View className="px-[22px]">
          <BackHeader
            title="Confirm buy"
            onBack={() => {
              setPin("");
              setStep("amount");
            }}
          />
        </View>
        <Settle>
          <View className="mt-[26px] items-center">
            <Label>Buying</Label>
            <Display className="text-[40px] leading-[42px] mt-[10px]">
              ₦{withCommas(digits)}
              <Display className="text-[24px] leading-[25.2px] text-figure-tail">
                .00
              </Display>
            </Display>
            <Mono className="text-[12.5px] text-sub mt-[8px]">
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
          className="px-[22px] pb-[36px]"
          style={{
            marginTop: "auto",
          }}
        >
          <View className="items-center">
            <Label>Enter PIN to buy</Label>
          </View>
          <View className="mt-[16px] mb-[20px]">
            <PinDots filled={pin.length} />
          </View>
          <Keypad onKey={handlePinKey} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <View className="flex-1 px-[22px]">
        <BackHeader title="Buy" onBack={onBack} />
        <View className="mt-[24px]">
          <SectionHead
            label="Pick an asset"
            right={
              <Mono className="text-[9.5px] text-dim tracking-[1.3px]">
                PRICE · 24H
              </Mono>
            }
          />
          <View className="mt-[2px]">
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
        <View className="flex-1" />
        <View className="items-center gap-[12px] pb-[34px]">
          <Body className="text-[11.5px] text-dim text-center">
            Bought assets settle into your crypto holdings.
          </Body>
          <MetaChip
            label={
              availableLabel
                ? `Fiat balance · ${availableLabel}`
                : "Fiat balance not available yet"
            }
          />
        </View>
      </View>
    </View>
  );
}
