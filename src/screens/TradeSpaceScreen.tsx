import React from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, withAlpha } from "../theme/tokens";
import {
  Screen,
  Card,
  MetallicButton,
  GhostButton,
  Label,
  Mono,
  Body,
  Display,
  Spark,
  BackChevron,
} from "../components/ui";
import { leaders } from "../data/mock";

const myCopy = {
  name: "Amara Okafor",
  sub: "$250 allocated · 3 positions mirrored",
  pnl: "+$11.20",
  pct: "+4.5%",
};

// Design 3a: trade space — trading balance, my copies, leader directory (Worldstreet).
export default function TradeSpaceScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <View className="flex-row items-center gap-[10px] pt-[10px]">
        <Pressable onPress={onBack} hitSlop={10}>
          <BackChevron />
        </Pressable>
        <View
          className="w-[30px] h-[30px] rounded-[16px] items-center justify-center"
          style={{
            backgroundColor: C.card,
          }}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24">
            <Path
              d="M3.5 17 9 11.5l4 3L20.5 7"
              stroke={C.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <Path
              d="M15.5 7h5v5"
              stroke={C.accent}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
        <Display className="text-[20px] leading-[21px]">Copy trading</Display>
        <View className="flex-1" />
        <View
          className="border rounded-[99px] px-[9px] py-[3px]"
          style={{
            borderColor: C.border,
          }}
        >
          <Body className="text-[10px] text-dim">Worldstreet</Body>
        </View>
      </View>
      <View className="mt-[24px]">
        <Body className="text-[11.5px] text-dim">Trading balance</Body>
        <Display className="text-[46px] leading-[48.3px] mt-[6px]">
          $261
          <Display className="text-[26px] leading-[27.3px] text-dim">
            .20
          </Display>
        </Display>
        <Mono className="text-[12px] text-up mt-[8px]">
          +$11.20 all-time · ≈ ₦401,300
        </Mono>
      </View>
      <View className="mt-[16px] flex-row gap-[10px]">
        <View className="flex-1">
          <MetallicButton label="Top up" height={46} radius={14} size={13} />
        </View>
        <View className="flex-1">
          <GhostButton label="Withdraw" />
        </View>
      </View>
      <Card className="mt-[16px] rounded-[16px] py-[13px] px-[15px]">
        <Label className="text-[9.5px] text-accent">My copies · 1</Label>
        <View className="mt-[8px] flex-row items-center justify-between">
          <View>
            <Body className="text-[13.5px]" semibold>
              {myCopy.name}
            </Body>
            <Body className="text-[11px] text-dim mt-[2px]">{myCopy.sub}</Body>
          </View>
          <View className="items-end">
            <Mono className="text-[13.5px] text-up">{myCopy.pnl}</Mono>
            <Body className="text-[10.5px] text-up mt-[2px]">{myCopy.pct}</Body>
          </View>
        </View>
      </Card>
      <View className="mt-[18px]">
        <Label>Leaders</Label>
        {leaders.map((l, i) => (
          <View
            key={l.ini}
            className="flex-row items-center gap-[12px] py-[13px] border-b-rule"
            style={{
              borderBottomWidth: i === leaders.length - 1 ? 0 : 1,
            }}
          >
            <View
              className="w-[42px] h-[42px] rounded-[21px] items-center justify-center"
              style={{
                backgroundColor: C.card,
              }}
            >
              <Text className="font-display text-[14px] text-accent">
                {l.ini}
              </Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-[6px]">
                <Body className="text-[14px]" semibold>
                  {l.name}
                </Body>
                {l.risky ? (
                  <View
                    className="rounded-[5px] px-[6px] py-[2px]"
                    style={{
                      backgroundColor: withAlpha(C.amber, 0.12),
                    }}
                  >
                    <Text className="font-body-semibold text-[9.5px] text-amber">
                      HIGH RISK
                    </Text>
                  </View>
                ) : null}
              </View>
              <Body className="text-[11px] text-dim mt-[2px]">
                {l.handle} · Win {l.win} · DD {l.dd}
              </Body>
            </View>
            <View className="items-end">
              <Mono className="text-[14px] text-up">{l.pnl}</Mono>
              <View className="mt-[3px]">
                <Spark points={l.spark} color={l.up ? C.up : C.accent} />
              </View>
              <Body className="text-[9.5px] text-dim">{l.copiers}</Body>
            </View>
          </View>
        ))}
      </View>
      <Body className="text-[11px] text-dim text-center mt-[16px]">
        Mirrors execute against your allocation with your risk caps.
      </Body>
      <Body className="text-[11px] text-dim text-center mt-[6px] mb-[8px]">
        Mirror top traders — powered by Worldstreet
      </Body>
    </Screen>
  );
}
