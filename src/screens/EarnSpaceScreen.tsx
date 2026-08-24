import React from "react";
import { View, Text, Pressable } from "react-native";

import {
  Screen,
  Card,
  Label,
  Mono,
  Body,
  Display,
  MetallicButton,
  ProgressBar,
  BackChevron,
} from "../components/ui";

// Design 3b: earn space — KSH balance, claimable points, weekly settlement, bounties.
const kash = {
  balance: "128.40",
  fiat: "≈ $173.84 · ₦267,700",
  points: "1,240 pts",
  pointsUsd: "· ≈ $16.90",
  gatePct: 62,
};
const bounties = [
  {
    title: "Copy your first trader",
    sub: "Any allocation counts",
    pts: "+750 pts",
  },
  {
    title: "Send cross-border",
    sub: "First corridor payment",
    pts: "+500 pts",
  },
  {
    title: "Win a Last Man round",
    sub: "Outlast the clock",
    pts: "+2,000 pts",
  },
];

export default function EarnSpaceScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <View className="flex-row items-center gap-[10px] pt-[10px]">
        <Pressable onPress={onBack} hitSlop={10}>
          <BackChevron />
        </Pressable>
        <View
          className="w-[30px] h-[30px] rounded-[16px] items-center justify-center"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Text className="text-[13px] text-accent">◆</Text>
        </View>
        <Display className="text-[20px] leading-[21px]">Earn · Kash</Display>
      </View>
      <Card
        className="mt-[18px] rounded-[22px] p-[18px]"
        style={{
          borderColor: "rgba(255,255,255,0.14)",
        }}
      >
        <View className="flex-row justify-between items-center">
          <Mono className="text-[10px] text-accent tracking-[2px]">◆ KASH</Mono>
          <Mono className="text-[9.5px] text-dim">KSH · ON-CHAIN</Mono>
        </View>
        <Body className="text-[11px] text-dim mt-[14px]">KSH balance</Body>
        <Display className="text-[34px] leading-[35.7px] mt-[4px]">
          {kash.balance}{" "}
          <Display className="text-[18px] leading-[18.9px] text-sub">
            KSH
          </Display>
        </Display>
        <Mono className="text-[12px] text-sub mt-[5px]">{kash.fiat}</Mono>
        <View
          className="h-[1px] my-[14px]"
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
          }}
        />
        <View className="flex-row items-center justify-between">
          <View>
            <Body className="text-[11px] text-dim">Claimable points</Body>
            <Body className="text-[14.5px] font-body-semibold mt-[3px]">
              {kash.points}{" "}
              <Mono className="text-[11.5px] text-sub">{kash.pointsUsd}</Mono>
            </Body>
          </View>
          <View className="w-[86px]">
            <MetallicButton label="Claim" height={36} radius={11} size={12.5} />
          </View>
        </View>
        <View
          className="mt-[16px] flex-row justify-between"
          style={{
            alignItems: "baseline",
          }}
        >
          <Label className="text-[9.5px]">Holding gate</Label>
          <Mono className="text-[11px]">{kash.gatePct}%</Mono>
        </View>
        <View className="mt-[7px]">
          <ProgressBar pct={kash.gatePct} />
        </View>
        <Body className="text-[10.5px] text-dim mt-[7px]">
          Gate is USD-denominated · redemptions capped at 25%/day
        </Body>
      </Card>
      <Body className="text-[11.5px] text-dim mt-[12px] leading-[19px]">
        Points earn live as you trade, play, and remit across KashPlus. Every
        Saturday 00:00 UTC they mint to KSH at the settlement price — points and
        KSH never mix.
      </Body>
      <View className="mt-[18px]">
        <Label>Ways to earn</Label>
        {bounties.map((b, i) => (
          <View
            key={b.title}
            className="flex-row items-center gap-[12px] py-[13px] border-b-rule"
            style={{
              borderBottomWidth: i === bounties.length - 1 ? 0 : 1,
            }}
          >
            <View
              className="w-[36px] h-[36px] rounded-[12px] items-center justify-center"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              <Text className="text-[13px] text-accent">◈</Text>
            </View>
            <View className="flex-1">
              <Body className="text-[13.5px]" semibold>
                {b.title}
              </Body>
              <Body className="text-[11px] text-dim mt-[2px]">{b.sub}</Body>
            </View>
            <Mono
              className="text-[11.5px] text-accent rounded-[8px] py-[5px] px-[10px] overflow-hidden"

              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            >
              {b.pts}
            </Mono>
          </View>
        ))}
      </View>
      <Body className="text-[11px] text-dim text-center mt-[24px] mb-[8px]">
        Points settle weekly — powered by Kash
      </Body>
    </Screen>
  );
}
