import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  GhostButton,
  Label,
  Mono,
  Body,
  Display,
  PressableScale,
  Shine,
} from "../components/ui";

// Fund wallet — the money-in hub.
//
// This screen used to offer a second route: "Crypto deposit", an eight-network
// picker that ended on a QR, a copy button and a "watching the chain" ticker.
// Every part of it was invented. The addresses were hardcoded literals, the
// 900ms "MINTING YOUR … ADDRESS" wait was a setTimeout, and the poll that
// claimed to be checking the chain made no request at all — it only re-read the
// clock. Two taps from /fiat, it handed a stranger's address to anyone with
// money to send.
//
// It is gone rather than wired because there is nothing to wire it to: the
// gateway's OpenAPI has no LinkPay crypto on-ramp, and Dextopus is
// subscription-only. A convincing address with no custodian behind it is money
// sent to an account nobody holds the key to, so the route does not exist until
// the rail does.
//
// What is left is the thing that was always real: the bank hand-off, which
// /fund-bank serves out of `useLinkpayAccount()`.

function Chevron({ color = C.dim }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9.5 5 16 12l-6.5 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * A funding method as a full plate rather than a list line. The method choice
 * is the only decision on this screen, so it gets the room it deserves.
 */
function MethodPlate({
  title,
  sub,
  detail,
  glyph,
  onPress,
}: {
  title: string;
  sub: string;
  detail: string;
  glyph: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scale={0.985}>
      <View
        accessibilityRole="button"
        accessibilityLabel={title}
        className="bg-canvas-raised border border-border rounded-[20px] p-[16px] overflow-hidden"
      >
        <Shine />
        <View className="flex-row items-center gap-[13px]">
          <View className="w-[40px] h-[40px] rounded-[13px] bg-canvas-inset border border-rule items-center justify-center">
            {glyph}
          </View>
          <View className="flex-1">
            <Body className="text-[15px]" semibold>
              {title}
            </Body>
            <Body className="text-[12px] text-sub mt-[3px]">{sub}</Body>
          </View>
          <Chevron />
        </View>
        <View className="mt-[13px] pt-[11px] border-t border-t-rule">
          <Mono className="text-[10px] text-dim tracking-[1.1px]">
            {detail}
          </Mono>
        </View>
      </View>
    </PressableScale>
  );
}

function BankGlyph() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M3 9.5 12 4l9 5.5M5 10v8m4.5-8v8m5-8v8m4.5-8v8M3 20h18"
        stroke={C.silver}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function FundScreen({
  onBack,
  onBankTransfer,
  onOpenReceive,
}: {
  onBack?: () => void;
  /** Bank transfer is its own screen — the real account, then the deposit watch. */
  onBankTransfer?: () => void;
  onOpenReceive?: () => void;
}) {
  return (
    <Screen>
      <BackHeader title="Add funds" onBack={onBack} />

      <View className="mt-[18px]">
        <Display className="text-[19px] leading-[19.95px] text-silver leading-[27px]">
          One way in, and it lands{"\n"}in an account in your name.
        </Display>

        <Label className="mt-[26px]">How money gets in</Label>
        <View className="mt-[12px]">
          {/* The sub-line says PERMANENT because that is what /fund-bank hands
              over. The earlier "a one-off account, issued to you for this
              transfer" promised an expiring number LinkPay does not issue — the
              next screen would have contradicted it on arrival. */}
          <MethodPlate
            title="Bank transfer"
            sub="Your own naira account. Send to it from any Nigerian bank."
            detail="PERMANENT NUMBER · CREDITED ON CONFIRMATION"
            glyph={<BankGlyph />}
            onPress={onBankTransfer}
          />
        </View>

        <View className="mt-[26px] pt-[18px] border-t border-t-rule">
          <GhostButton
            label="Show my account details"
            onPress={onOpenReceive}
          />
          <Body className="text-[11px] text-dim text-center mt-[14px] leading-[17px]">
            Your account number, ready to hand to someone else.
          </Body>
        </View>

        {/* Said once, quietly, rather than left as a route that mimes a
            deposit. Someone who used to reach the crypto picker from here
            deserves to know it is not open, not to find an address waiting. */}
        <Body className="text-[11px] text-dim mt-[22px] leading-[17px]">
          Crypto deposits that convert to naira are not open yet. Your wallet
          can still receive crypto — it stays crypto.
        </Body>
      </View>
    </Screen>
  );
}
