import React from "react";
import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  Card,
  MetallicButton,
  Mono,
  Body,
  BackChevron,
} from "../components/ui";

// Design 3d: The Last Man — pot, countdown, last-man row, pending claim, metallic CTA.
const round = {
  pot: "$1,240",
  clock: "04:32",
  lastMan: "@tobi",
  lastManInitials: "TO",
  entry: "$50",
};

export default function LastManScreen({ onBack }: { onBack?: () => void }) {
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
        <Mono size={11} color={C.sub} style={{ letterSpacing: 2 }}>
          THE LAST MAN · ROUND #63
        </Mono>
      </View>
      <View style={{ marginTop: 40, alignItems: "center" }}>
        <Mono size={10} color={C.dim} style={{ letterSpacing: 2.5 }}>
          IN THE POT
        </Mono>
        <Svg width="100%" height={70} style={{ marginTop: 8 }}>
          <Defs>
            <SvgGradient id="pot" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#f4f4f4" />
              <Stop offset="1" stopColor="#9b9b9b" />
            </SvgGradient>
          </Defs>
          <SvgText
            x="50%"
            y={58}
            textAnchor="middle"
            fontFamily={F.display}
            fontSize={64}
            fill="url(#pot)"
          >
            {round.pot}
          </SvgText>
        </Svg>
        <Text
          style={{
            marginTop: 26,
            fontFamily: F.monoSemibold,
            fontSize: 48,
            letterSpacing: 2,
            color: C.amber,
          }}
        >
          {round.clock}
        </Text>
        <Body size={11.5} color={C.dim} style={{ marginTop: 6 }}>
          until the pot pays out
        </Body>
      </View>
      <Card
        style={{
          marginTop: 30,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 18,
          paddingVertical: 14,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 22,
            backgroundColor: "rgba(245,184,61,0.14)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: F.display, fontSize: 14, color: C.amber }}>
            {round.lastManInitials}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Body size={14} semibold>
            {round.lastMan} is the last man
          </Body>
          <Body size={11} color={C.dim} style={{ marginTop: 2 }}>
            Took the lead 28s ago · 14th entry this round
          </Body>
        </View>
      </Card>
      <View
        style={{
          marginTop: 14,
          shadowColor: "#fff",
          shadowOpacity: 0.3,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <LinearGradient
          colors={C.metal}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderRadius: 16,
            paddingVertical: 13,
            paddingHorizontal: 15,
            overflow: "hidden",
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 1,
              left: 10,
              right: 10,
              height: 1,
              backgroundColor: "rgba(255,255,255,0.5)",
            }}
          />
          <Text style={{ fontSize: 15, color: C.ink }}>★</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontFamily: F.bodySemibold, fontSize: 13, color: C.ink }}
            >
              You won Round #62 — $920
            </Text>
            <Text
              style={{
                fontFamily: F.body,
                fontSize: 10.5,
                color: "rgba(10,11,13,0.6)",
                marginTop: 1,
              }}
            >
              Winnings are claim-based, not auto-credited
            </Text>
          </View>
          <View
            style={{
              backgroundColor: C.ink,
              borderRadius: 10,
              paddingVertical: 8,
              paddingHorizontal: 14,
            }}
          >
            <Text
              style={{
                fontFamily: F.bodySemibold,
                fontSize: 12,
                color: "#e8e8ea",
              }}
            >
              Claim
            </Text>
          </View>
        </LinearGradient>
      </View>
      <View style={{ marginTop: 44 }}>
        <Body
          size={11}
          color={C.dim}
          style={{ textAlign: "center", lineHeight: 17.5, marginBottom: 14 }}
        >
          {
            "Pay the $50 entry to become the last man and reset the clock.\nIf it hits zero while you’re last — the whole pot is yours."
          }
        </Body>
        <MetallicButton
          label="Become the last man · $50"
          height={56}
          radius={18}
          size={16}
        />
        <Mono
          size={10}
          color={C.dim}
          style={{ marginTop: 10, textAlign: "center" }}
        >
          ON-CHAIN FROM YOUR WALLET · SIGNED WITH FACE ID
        </Mono>
      </View>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 14, marginBottom: 8 }}
      >
        One pot, one clock — powered by Ark
      </Body>
    </Screen>
  );
}
