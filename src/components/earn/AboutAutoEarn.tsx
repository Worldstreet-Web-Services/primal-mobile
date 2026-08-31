import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { useTokens } from "@/theme/tokens";
import {
  ClockIcon,
  CloseIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TrendUpIcon,
} from "../icons";
import { Body, CircleAction, Display, MetallicButton } from "../ui";

interface Point {
  key: string;
  title: string;
  body: string;
  icon: (color: string) => React.ReactNode;
}

/**
 * What the header's ⓘ opens. Copy lives here rather than on the screen: it
 * explains the product, not the state of the form behind it.
 */
const POINTS: Point[] = [
  {
    key: "flexible",
    title: "Flexible",
    body: "Withdraw anytime with no lock-up period or penalties.",
    icon: (color) => <ClockIcon size={16} color={color} />,
  },
  {
    key: "secure",
    title: "Secure",
    body: "Funds are protected by institutional-grade smart contracts.",
    icon: (color) => <ShieldCheckIcon size={16} color={color} />,
  },
  {
    key: "automatic",
    title: "Automatic",
    body: "Yields are compounded daily without any manual action needed.",
    icon: (color) => <TrendUpIcon size={16} color={color} />,
  },
];

/**
 * A centred dialog rather than a bottom sheet: this is an aside about the
 * screen behind it, and the form stays visible around the edges so it reads as
 * an explanation of that form rather than a step in it.
 */
export function AboutAutoEarn({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTokens();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* The scrim is the dismiss target, so the card sits inside it as a
          non-pressable child rather than beside it. */}
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        className="flex-1 items-center justify-center px-[20px]"
        style={{ backgroundColor: "rgba(0,0,0,0.62)" }}
      >
        <Pressable
          // Swallows the tap so pressing the card never closes it.
          onPress={() => {}}
          className="w-full rounded-[24px] border border-border bg-key p-[22px]"
        >
          <View className="flex-row items-center gap-[12px]">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-brand-glow">
              <SparkleIcon size={18} color={t.brandSoft} />
            </View>
            <Display className="flex-1 text-[19px] leading-[22px]">
              About Auto Earn
            </Display>
            <CircleAction
              size={30}
              onPress={onClose}
              accessibilityLabel="Close"
              className="border-transparent bg-card"
            >
              <CloseIcon size={14} color={t.silver} />
            </CircleAction>
          </View>

          <Body className="mt-[18px] text-[13px] leading-[20px] text-sub">
            Auto Earn lets you put your idle funds to work. Simply enter an
            amount, and your funds will automatically generate yield through our
            secure investment strategies. Returns are calculated daily and
            compounded, so your earnings grow over time.
          </Body>

          <View className="mt-[20px] gap-[16px]">
            {POINTS.map((point) => (
              <View key={point.key} className="flex-row gap-[12px]">
                <View className="h-[32px] w-[32px] items-center justify-center rounded-[11px] bg-brand-glow">
                  {point.icon(t.brandSoft)}
                </View>
                <View className="flex-1">
                  <Text className="font-body-semibold text-[14px] text-text">
                    {point.title}
                  </Text>
                  <Body className="mt-[2px] text-[12.5px] leading-[18px] text-dim">
                    {point.body}
                  </Body>
                </View>
              </View>
            ))}
          </View>

          <View className="mt-[22px]">
            <MetallicButton
              label="Got it"
              size={16}
              height={54}
              onPress={onClose}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
