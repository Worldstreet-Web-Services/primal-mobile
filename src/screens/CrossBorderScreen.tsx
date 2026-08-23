import React from "react";
import { View, Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackChevron,
  Display,
  Body,
  Mono,
  Label,
  GhostButton,
  PulseDot,
  SectionRule,
  Shine,
  METAL_ANGLE,
} from "../components/ui";

// Design 4f: cross-border — provider-priced quote, then the rail narrating
// itself. The settling stage carries the concierge line: what is happening,
// how long it takes, and the permission to walk away from the screen.
type StageState = "done" | "active" | "todo";
type Stage = {
  title: string;
  sub: string;
  state: StageState;
  link?: "done" | "toAmber" | "idle";
  /** Concierge narration — only the stage that is actually waiting gets one. */
  narration?: string;
};

const stages: Stage[] = [
  {
    title: "Quote locked",
    sub: "14:02 · rate held for this transfer",
    state: "done",
    link: "done",
  },
  {
    title: "Naira debited",
    sub: "14:02 · idempotency-keyed, taken once",
    state: "done",
    link: "toAmber",
  },
  {
    title: "Settling · USDC on Base",
    sub: "On the rail since 14:02",
    state: "active",
    link: "idle",
    narration:
      "The dollars are moving on Base. Stanbic pays Kofi the moment they land — you can leave this screen, it keeps going without you.",
  },
  {
    title: "Paid out · Stanbic GH",
    sub: "Kofi is alerted the moment it lands",
    state: "todo",
  },
];

function StageNode({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <LinearGradient
        colors={C.metal}
        locations={C.metalStops}
        start={METAL_ANGLE.start}
        end={METAL_ANGLE.end}
        style={{
          width: 22,
          height: 22,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={12} height={12} viewBox="0 0 24 24">
          <Path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke={C.canvas}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </LinearGradient>
    );
  }
  if (state === "active") {
    return (
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: C.amber,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PulseDot color={C.amber} size={8} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 12,
        borderWidth: 2,
        // The stage still ahead: the quietest of the three nodes, but it has to
        // survive the lighter ground. Neutral border rather than the old silver
        // tint, which now agrees with the rail running through it.
        borderColor: C.border,
      }}
    />
  );
}

/** Quote line: tracked label on the left, the figure in mono on the right. */
function QuoteRow({
  label,
  value,
  note,
  last,
}: {
  label: string;
  value: string;
  note?: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View>
        <Mono size={9} color={C.dim} style={{ letterSpacing: 1.4 }}>
          {label}
        </Mono>
        {note ? (
          <Mono size={10} color={C.dim} style={{ marginTop: 4 }}>
            {note}
          </Mono>
        ) : null}
      </View>
      <Mono size={12.5} color={C.silver}>
        {value}
      </Mono>
    </View>
  );
}

export default function CrossBorderScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: 10,
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackChevron />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Display size={20}>To Ghana</Display>
          <Mono
            size={9.5}
            color={C.dim}
            style={{ marginTop: 3, letterSpacing: 1.4 }}
          >
            NGN → GHS · WORLDSTREET RAIL
          </Mono>
        </View>
      </View>

      <View style={{ marginTop: 28, alignItems: "center" }}>
        <Label style={{ letterSpacing: 2 }}>Kofi receives</Label>
        <Text
          style={{
            fontFamily: F.monoSemibold,
            fontSize: 38,
            letterSpacing: -0.5,
            color: C.text,
            marginTop: 12,
          }}
        >
          <Text style={{ fontSize: 24, color: C.sub }}>GH₵</Text>
          41,208
          <Text style={{ fontSize: 21, color: C.dim }}>.50</Text>
        </Text>
        <Mono
          size={11.5}
          color={C.dim}
          style={{ marginTop: 8, letterSpacing: 0.4 }}
        >
          ≈ $326.10 · you sent ₦500,000.00
        </Mono>
      </View>

      <View
        style={{
          marginTop: 24,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          borderRadius: 18,
          paddingHorizontal: 16,
          overflow: "hidden",
        }}
      >
        <Shine />
        <QuoteRow label="RATE" value="1 NGN → 0.08242 GHS" />
        <QuoteRow label="FEE" value="₦1,250.00" note="in quote" />
        <QuoteRow label="RECIPIENT" value="Kofi Mensah · Stanbic GH" last />
      </View>

      <SectionRule space={24} />

      <Label>Progress</Label>
      <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
        {stages.map((s, i) => (
          <View key={s.title} style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center" }}>
              <StageNode state={s.state} />
              {i < stages.length - 1 ? (
                s.link === "toAmber" ? (
                  <LinearGradient
                    colors={[C.silver, C.amber]}
                    style={{ width: 2, flex: 1 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      // Settled rail in silver, not the old near-white: on the
                      // charcoal ground that value stopped reading as "behind
                      // you" and started reading as a lit wire down the page.
                      // The rail ahead is a plain border — structure, not state.
                      backgroundColor: s.link === "done" ? C.silver : C.border,
                    }}
                  />
                )
              ) : null}
            </View>
            <View
              style={{ flex: 1, paddingBottom: i < stages.length - 1 ? 22 : 0 }}
            >
              <Body
                size={13.5}
                semibold
                color={
                  s.state === "active"
                    ? C.amber
                    : s.state === "todo"
                      ? C.dim
                      : C.text
                }
              >
                {s.title}
              </Body>
              <Mono size={10.5} color={C.dim} style={{ marginTop: 4 }}>
                {s.sub}
              </Mono>
              {s.narration ? (
                <View
                  style={{
                    marginTop: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: "rgba(245,184,61,0.26)",
                    backgroundColor: "rgba(245,184,61,0.07)",
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                    }}
                  >
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: C.amber,
                      }}
                    />
                    <Mono
                      size={8.5}
                      color={C.amber}
                      style={{ letterSpacing: 1.6 }}
                    >
                      IN FLIGHT
                    </Mono>
                    <View style={{ flex: 1 }} />
                    <Mono
                      size={8.5}
                      color={C.dim}
                      style={{ letterSpacing: 1.4 }}
                    >
                      USUALLY UNDER 2 MIN
                    </Mono>
                  </View>
                  <Body
                    size={12}
                    color={C.silver}
                    style={{ marginTop: 9, lineHeight: 18 }}
                  >
                    {s.narration}
                  </Body>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <SectionRule space={24} />

      <GhostButton label="Share receipt" height={48} />
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 14, lineHeight: 16 }}
      >
        Priced by the provider. KashPlus adds nothing on top.
      </Body>
    </Screen>
  );
}
