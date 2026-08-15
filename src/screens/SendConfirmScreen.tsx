import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  BackChevron,
  Mono,
  Body,
  Display,
  Label,
  PinDots,
  Keypad,
  SectionRule,
  Shine,
} from "../components/ui";

// Design 4e: send confirm — the name the bank returned, the provider's price,
// then four digits. The resolved name is staged like a seal: it is the only
// thing on this screen that proves the money is going where it was meant to.
const PIN_LENGTH = 4;
const recipient = {
  name: "ADEBAYO KEHINDE",
  bank: "GTBank",
  account: "0123 456 789",
  at: "14:02",
};
const amount = {
  naira: "45,000",
  kobo: ".00",
  usd: "≈ $29.30 USD",
  fee: "₦26.88",
  total: "₦45,026.88",
};

function Check({
  size = 18,
  color = C.brandSoft,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Row({
  label,
  value,
  note,
  strong,
  last,
}: {
  label: string;
  value: string;
  /** The quiet half of the figure — where the number came from. */
  note?: string;
  strong?: boolean;
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
      <Text
        style={{
          fontFamily: strong ? F.monoSemibold : F.mono,
          fontSize: strong ? 14 : 12.5,
          color: strong ? C.text : C.silver,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function SendConfirmScreen({
  onBack,
  onConfirm,
}: {
  onBack?: () => void;
  onConfirm?: () => void;
}) {
  const [pin, setPin] = useState("");

  // The one motion moment: the seal arrives a beat after the screen, the way a
  // stamp lands on a document. Everything else here holds still.
  const seal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(seal, {
      toValue: 1,
      useNativeDriver: true,
      speed: 14,
      bounciness: 4,
    }).start();
  }, [seal]);
  const lift = seal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const handleKey = (k: string) => {
    if (k === "del") {
      setPin(pin.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LENGTH && onConfirm) setTimeout(onConfirm, 350);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: 10,
          paddingHorizontal: 22,
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
          <Display size={20}>Confirm</Display>
          <Mono
            size={9.5}
            color={C.dim}
            style={{ marginTop: 3, letterSpacing: 1.4 }}
          >
            LAST LOOK BEFORE IT LEAVES
          </Mono>
        </View>
      </View>

      {/* The seal: the name the bank gave back, staged as the proof it is. */}
      <Animated.View
        style={{
          marginTop: 18,
          marginHorizontal: 20,
          opacity: seal,
          transform: [{ translateY: lift }],
        }}
      >
        <View
          style={{
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: "rgba(131,190,96,0.34)",
            borderRadius: 20,
            overflow: "hidden",
            shadowColor: C.brand,
            shadowOpacity: 0.1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Shine />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingHorizontal: 16,
              paddingTop: 16,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: C.brandGlow,
                borderWidth: 1,
                borderColor: "rgba(131,190,96,0.34)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Mono
                size={8.5}
                color={C.brandSoft}
                style={{ letterSpacing: 1.6 }}
              >
                NAME ENQUIRY
              </Mono>
              <Body
                size={15}
                semibold
                style={{ letterSpacing: 0.4, marginTop: 4 }}
              >
                {recipient.name}
              </Body>
              <Mono size={11} color={C.sub} style={{ marginTop: 3 }}>
                {recipient.bank} · {recipient.account}
              </Mono>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <SectionRule space={14} />
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <Body size={11.5} color={C.dim} style={{ lineHeight: 17 }}>
              Returned by {recipient.bank} at {recipient.at}. A bank transfer
              cannot be recalled once it is sent.
            </Body>
          </View>
        </View>
      </Animated.View>

      <View style={{ marginTop: 22, alignItems: "center" }}>
        <Label style={{ letterSpacing: 2 }}>You're sending</Label>
        <Text
          style={{
            fontFamily: F.monoSemibold,
            fontSize: 40,
            letterSpacing: -0.5,
            color: C.text,
            marginTop: 12,
          }}
        >
          <Text style={{ fontSize: 26, color: C.sub }}>₦</Text>
          {amount.naira}
          <Text style={{ fontSize: 22, color: C.dim }}>{amount.kobo}</Text>
        </Text>
        <Mono
          size={11.5}
          color={C.dim}
          style={{ marginTop: 8, letterSpacing: 0.4 }}
        >
          {amount.usd}
        </Mono>
      </View>

      <View
        style={{
          marginTop: 22,
          marginHorizontal: 20,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          borderRadius: 18,
          paddingHorizontal: 16,
          overflow: "hidden",
        }}
      >
        <Shine />
        <Row label="FEE" value={amount.fee} note="provider quote" />
        <Row label="TOTAL DEBIT" value={amount.total} strong last />
      </View>

      <View
        style={{
          marginTop: "auto",
          paddingTop: 26,
          paddingHorizontal: 22,
          paddingBottom: 28,
        }}
      >
        <Body size={12.5} color={C.sub} style={{ textAlign: "center" }}>
          Your PIN releases the transfer.
        </Body>
        <View style={{ marginTop: 16, marginBottom: 18 }}>
          <PinDots filled={pin.length} />
        </View>
        <Keypad onKey={handleKey} />
      </View>
    </View>
  );
}
