import type { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { PressableScale, Shine, Body, Mono } from "@/components/ui";
import { C } from "@/theme/tokens";

function Chevron() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9.5 5 16 12l-6.5 7"
        stroke={C.dim}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function BankGlyph() {
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

export function CryptoGlyph({ direction = "in" }: { direction?: "in" | "out" }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d={
          direction === "in"
            ? "M12 3v13m0 0-4-4m4 4 4-4M5 20h14"
            : "M12 21V8m0 0-4 4m4-4 4 4M5 4h14"
        }
        stroke={C.silver}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** One money rail, with the balance it affects stated before the tap. */
export function MovementMethodPlate({
  title,
  sub,
  detail,
  glyph,
  onPress,
  disabled = false,
  disabledLabel = "BACKEND ROUTE REQUIRED",
}: {
  title: string;
  sub: string;
  detail: string;
  glyph: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <PressableScale onPress={disabled ? undefined : onPress} scale={0.985}>
      <View
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled }}
        style={{
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 20,
          padding: 16,
          overflow: "hidden",
          opacity: disabled ? 0.64 : 1,
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
            <Body size={12} color={C.sub} style={{ marginTop: 3, lineHeight: 17 }}>
              {sub}
            </Body>
          </View>
          {disabled ? (
            <Mono
              size={8.5}
              color={C.dim}
              style={{ letterSpacing: 0.9, maxWidth: 74, textAlign: "right" }}
            >
              {disabledLabel}
            </Mono>
          ) : (
            <Chevron />
          )}
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
