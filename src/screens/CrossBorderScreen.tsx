import React from "react";
import { View, Pressable, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { C, metalStops, withAlpha } from "../theme/tokens";
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
        locations={metalStops}
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
        className="w-[22px] h-[22px] rounded-[12px] border-amber items-center justify-center"
        style={{
          borderWidth: 2,
        }}
      >
        <PulseDot color={C.amber} size={8} />
      </View>
    );
  }
  return (
    <View
      className="w-[22px] h-[22px] rounded-[12px]"
      style={{
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
      className="flex-row items-center justify-between py-[13px] border-b-rule"
      style={{
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <View>
        <Mono className="text-[9px] text-dim tracking-[1.4px]">{label}</Mono>
        {note ? (
          <Mono className="text-[10px] text-dim mt-[4px]">{note}</Mono>
        ) : null}
      </View>
      <Mono className="text-[12.5px] text-silver">{value}</Mono>
    </View>
  );
}

export default function CrossBorderScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <View className="flex-row items-center gap-[12px] pt-[10px]">
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackChevron />
        </Pressable>
        <View className="flex-1">
          <Display className="text-[20px] leading-[21px]">To Ghana</Display>
          <Mono className="text-[9.5px] text-dim mt-[3px] tracking-[1.4px]">
            NGN → GHS · WORLDSTREET RAIL
          </Mono>
        </View>
      </View>

      <View className="mt-[28px] items-center">
        <Label className="tracking-[2px]">Kofi receives</Label>
        <Text className="font-mono-semibold text-[38px] tracking-[-0.5px] text-text mt-[12px]">
          <Text className="text-[24px] text-sub">GH₵</Text>
          41,208
          <Text className="text-[21px] text-dim">.50</Text>
        </Text>
        <Mono className="text-[11.5px] text-dim mt-[8px] tracking-[0.4px]">
          ≈ $326.10 · you sent ₦500,000.00
        </Mono>
      </View>

      <View className="mt-[24px] bg-canvas-raised border border-rule rounded-[18px] px-[16px] overflow-hidden">
        <Shine />
        <QuoteRow label="RATE" value="1 NGN → 0.08242 GHS" />
        <QuoteRow label="FEE" value="₦1,250.00" note="in quote" />
        <QuoteRow label="RECIPIENT" value="Kofi Mensah · Stanbic GH" last />
      </View>

      <SectionRule space={24} />

      <Label>Progress</Label>
      <View className="mt-[16px] px-[4px]">
        {stages.map((s, i) => (
          <View key={s.title} className="flex-row gap-[14px]">
            <View className="items-center">
              <StageNode state={s.state} />
              {i < stages.length - 1 ? (
                s.link === "toAmber" ? (
                  <LinearGradient
                    colors={[C.silver, C.amber]}
                    style={{ width: 2, flex: 1 }}
                  />
                ) : (
                  <View
                    className="w-[2px] flex-1"
                    style={{
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
              className="flex-1"
              style={{ paddingBottom: i < stages.length - 1 ? 22 : 0 }}
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
              <Mono className="text-[10.5px] text-dim mt-[4px]">{s.sub}</Mono>
              {s.narration ? (
                <View
                  className="mt-[12px] rounded-[14px] border px-[14px] py-[12px]"
                  style={{
                    borderColor: withAlpha(C.amber, 0.26),
                    backgroundColor: withAlpha(C.amber, 0.07),
                  }}
                >
                  <View className="flex-row items-center gap-[7px]">
                    <View className="w-[5px] h-[5px] rounded-[3px] bg-amber" />
                    <Mono className="text-[8.5px] text-amber tracking-[1.6px]">
                      IN FLIGHT
                    </Mono>
                    <View className="flex-1" />
                    <Mono className="text-[8.5px] text-dim tracking-[1.4px]">
                      USUALLY UNDER 2 MIN
                    </Mono>
                  </View>
                  <Body className="text-[12px] text-silver mt-[9px] leading-[18px]">
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
      <Body className="text-[11px] text-dim text-center mt-[14px] leading-[16px]">
        Priced by the provider. KashPlus adds nothing on top.
      </Body>
    </Screen>
  );
}
