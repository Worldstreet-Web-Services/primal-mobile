import React from "react";
import { View, Text, Pressable } from "react-native";
import { C } from "../theme/tokens";
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
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: 10,
        }}
      >
        <Pressable onPress={onBack} hitSlop={10}>
          <BackChevron />
        </Pressable>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 13, color: C.accent }}>◆</Text>
        </View>
        <Display size={20}>Earn · Kash</Display>
      </View>
      <Card
        style={{
          marginTop: 18,
          borderRadius: 22,
          padding: 18,
          borderColor: "rgba(255,255,255,0.14)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Mono size={10} color={C.accent} style={{ letterSpacing: 2 }}>
            ◆ KASH
          </Mono>
          <Mono size={9.5} color={C.dim}>
            KSH · ON-CHAIN
          </Mono>
        </View>
        <Body size={11} color={C.dim} style={{ marginTop: 14 }}>
          KSH balance
        </Body>
        <Display size={34} style={{ marginTop: 4 }}>
          {kash.balance}{" "}
          <Display size={18} color={C.sub}>
            KSH
          </Display>
        </Display>
        <Mono size={12} color={C.sub} style={{ marginTop: 5 }}>
          {kash.fiat}
        </Mono>
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255,255,255,0.1)",
            marginVertical: 14,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Body size={11} color={C.dim}>
              Claimable points
            </Body>
            <Body size={14.5} semibold style={{ marginTop: 3 }}>
              {kash.points}{" "}
              <Mono size={11.5} color={C.sub}>
                {kash.pointsUsd}
              </Mono>
            </Body>
          </View>
          <View style={{ width: 86 }}>
            <MetallicButton label="Claim" height={36} radius={11} size={12.5} />
          </View>
        </View>
        <View
          style={{
            marginTop: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Label style={{ fontSize: 9.5 }}>Holding gate</Label>
          <Mono size={11}>{kash.gatePct}%</Mono>
        </View>
        <View style={{ marginTop: 7 }}>
          <ProgressBar pct={kash.gatePct} />
        </View>
        <Body size={10.5} color={C.dim} style={{ marginTop: 7 }}>
          Gate is USD-denominated · redemptions capped at 25%/day
        </Body>
      </Card>
      <Body size={11.5} color={C.dim} style={{ marginTop: 12, lineHeight: 19 }}>
        Points earn live as you trade, play, and remit across Paradigm. Every
        Saturday 00:00 UTC they mint to KSH at the settlement price — points and
        KSH never mix.
      </Body>
      <View style={{ marginTop: 18 }}>
        <Label>Ways to earn</Label>
        {bounties.map((b, i) => (
          <View
            key={b.title}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 13,
              borderBottomWidth: i === bounties.length - 1 ? 0 : 1,
              borderBottomColor: C.hairline,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.06)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 13, color: C.accent }}>◈</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Body size={13.5} semibold>
                {b.title}
              </Body>
              <Body size={11} color={C.dim} style={{ marginTop: 2 }}>
                {b.sub}
              </Body>
            </View>
            <Mono
              size={11.5}
              color={C.accent}
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 8,
                paddingVertical: 5,
                paddingHorizontal: 10,
                overflow: "hidden",
              }}
            >
              {b.pts}
            </Mono>
          </View>
        ))}
      </View>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 24, marginBottom: 8 }}
      >
        Points settle weekly — powered by Kash
      </Body>
    </Screen>
  );
}
