import React from "react";
import { View, Text } from "react-native";
import { C } from "../theme/tokens";
import { cn } from "@/lib/cn";
import {
  Screen,
  Label,
  Mono,
  Body,
  Display,
  AmountText,
  MetallicButton,
  GhostButton,
} from "../components/ui";

// Portfolio tab — the HOLD view of buy-and-hold: total value, how it splits,
// every holding, then the two ways money moves (buy more / withdraw).
const total = {
  usd: "$18,585.60",
  naira: "≈ ₦28,715,000",
  gain: "+$212.40 all-time",
};

// Getters: read at render, not at import — see the note on `BEVEL.outline`.
const allocation = [
  {
    key: "Fiat",
    pct: 45,
    get color() {
      return C.silver;
    },
  },
  {
    key: "Crypto",
    pct: 30,
    get color() {
      return C.up;
    },
  },
  {
    key: "Trading",
    pct: 15,
    get color() {
      return C.accent;
    },
  },
  {
    key: "Kash",
    pct: 10,
    get color() {
      return C.amber;
    },
  },
];

type Holding = {
  sym: string;
  name: string;
  qty: string;
  usd: string;
  delta?: string;
};
const holdings: Holding[] = [
  { sym: "₦", name: "Fiat", qty: "₦482,650.00", usd: "$312.40" },
  { sym: "Ξ", name: "ETH", qty: "0.031 ETH", usd: "$98.10", delta: "+2.1%" },
  { sym: "◎", name: "SOL", qty: "0.62 SOL", usd: "$84.30", delta: "-0.8%" },
  { sym: "$", name: "USDC", qty: "130.00 · Base", usd: "$130.00" },
  {
    sym: "⇄",
    name: "Trading balance",
    qty: "Copy trading",
    usd: "$261.20",
    delta: "+4.5%",
  },
  { sym: "◆", name: "Kash", qty: "128.40 KSH", usd: "$173.84" },
];

export default function PortfolioScreen({
  onBuy,
  onWithdraw,
  bottom = 40,
}: {
  onBuy?: () => void;
  onWithdraw?: () => void;
  /** Tail space — raise it when something overlays the bottom of the screen. */
  bottom?: number;
}) {
  return (
    <Screen bottom={bottom}>
      {/* Tab root, so a plain title — no back chevron. */}
      <Display className="text-[20px] leading-[21px] pt-[10px]">
        Portfolio
      </Display>

      <View className="mt-[26px]">
        <Body className="text-[11.5px] text-dim">Total value</Body>
        <AmountText value={total.usd} size={40} className="mt-[6px]" />
        <Mono className="text-[12px] text-sub mt-[8px]">
          {total.naira} ·{" "}
          <Mono className="text-[12px] text-up">{total.gain}</Mono>
        </Mono>
      </View>

      <View className="mt-[20px]">
        <View className="flex-row h-[8px] rounded-[4px] overflow-hidden gap-[2px]">
          {allocation.map((a) => (
            <View
              key={a.key}
              style={{ flex: a.pct, backgroundColor: a.color }}
            />
          ))}
        </View>
        <View className="mt-[10px] flex-row flex-wrap gap-[14px]">
          {allocation.map((a) => (
            <View key={a.key} className="flex-row items-center gap-[6px]">
              <View
                className="w-[6px] h-[6px] rounded-[3px]"
                style={{
                  backgroundColor: a.color,
                }}
              />
              <Mono className="text-[10.5px] text-sub">
                {a.key} {a.pct}%
              </Mono>
            </View>
          ))}
        </View>
      </View>

      <Label className="mt-[24px]">Holdings</Label>
      {holdings.map((h, i) => (
        <View
          key={h.name}
          className="flex-row items-center gap-[12px] py-[12px] border-b-rule"
          style={{
            borderBottomWidth: i === holdings.length - 1 ? 0 : 1,
          }}
        >
          <View
            className="w-[38px] h-[38px] rounded-[12px] items-center justify-center"
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text className="font-mono text-[14px] text-silver">{h.sym}</Text>
          </View>
          <View className="flex-1">
            <Body className="text-[13.5px]" semibold>
              {h.name}
            </Body>
            <Body className="text-[11.5px] text-dim mt-[2px]">{h.qty}</Body>
          </View>
          <View className="items-end">
            <Mono className="text-[13px] text-text">{h.usd}</Mono>
            {h.delta ? (
              <Mono
                size={11}

                className={cn(
                  "mt-[2px]",
                  h.delta.startsWith("-") ? "text-down" : "text-up",
                )}
              >
                {h.delta}
              </Mono>
            ) : null}
          </View>
        </View>
      ))}

      <View className="mt-[22px] flex-row gap-[10px]">
        <View className="flex-1">
          <MetallicButton
            label="Buy more"
            height={50}
            radius={14}
            size={13.5}
            onPress={onBuy}
          />
        </View>
        <View className="flex-1">
          <GhostButton label="Withdraw" height={50} onPress={onWithdraw} />
        </View>
      </View>
    </Screen>
  );
}
