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
        style={{
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 20,
          padding: 16,
          overflow: "hidden",
        }}
      >
        <Shine />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              backgroundColor: C.inset,
              borderWidth: 1,
              borderColor: C.hairline,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {glyph}
          </View>
          <View style={{ flex: 1 }}>
            <Body size={15} semibold>
              {title}
            </Body>
            <Body size={12} color={C.sub} style={{ marginTop: 3 }}>
              {sub}
            </Body>
          </View>
          <Chevron />
        </View>
        <View
          style={{
            marginTop: 13,
            paddingTop: 11,
            borderTopWidth: 1,
            borderTopColor: C.hairline,
          }}
        >
          <Mono size={10} color={C.dim} style={{ letterSpacing: 1.1 }}>
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

      <View style={{ marginTop: 18 }}>
        <Display size={19} color={C.silver} style={{ lineHeight: 27 }}>
          One way in, and it lands{"\n"}in an account in your name.
        </Display>

        <Label style={{ marginTop: 26 }}>How money gets in</Label>
        <View style={{ marginTop: 12 }}>
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

        <View
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTopWidth: 1,
            borderTopColor: C.hairline,
          }}
        >
          <GhostButton label="Show my account details" onPress={onOpenReceive} />
          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 14, lineHeight: 17 }}
          >
            Your account number, ready to hand to someone else.
          </Body>
        </View>

        {/* Said once, quietly, rather than left as a route that mimes a
            deposit. Someone who used to reach the crypto picker from here
            deserves to know it is not open, not to find an address waiting. */}
        <Body
          size={11}
          color={C.dim}
          style={{ marginTop: 22, lineHeight: 17 }}
        >
          Crypto deposits that convert to naira are not open yet. Your wallet
          can still receive crypto — it stays crypto.
        </Body>
      </View>
    </Screen>
  );
}
