import * as Clipboard from "expo-clipboard";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, View, ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { C, F } from "../theme/tokens";
import { Mono } from "./ui";

const HOLD_MS = 1600;

/**
 * Copy state as a hook, so a screen with several copyable fields keeps one
 * source of truth for "which one just landed" and every affordance below
 * reports the same way.
 */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (key: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
    } catch {
      // A refused clipboard is not worth a dialog; the value stays on screen
      // and selectable, which is the fallback people already reach for.
      return;
    }
    setCopied(key);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), HOLD_MS);
  }, []);

  return { copied, copy };
}

function CopyGlyph({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Rect
        x={9}
        y={9}
        width={11}
        height={11}
        rx={2.5}
        stroke={color}
        strokeWidth={1.9}
        fill="none"
      />
      <Path
        d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function CheckGlyph({ color }: { color: string }) {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * The copy mark: the glyph swaps for a check on a short spring, in place.
 *
 * Deliberately not a toast. A toast says "the app noticed"; a mark that
 * changes under your own thumb says "the machine did the thing", and it never
 * covers the number you are mid-way through reading off the screen.
 */
export function CopyMark({ copied, label }: { copied: boolean; label?: string }) {
  const v = useRef(new Animated.Value(copied ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(v, {
      toValue: copied ? 1 : 0,
      useNativeDriver: true,
      speed: 26,
      bounciness: 7,
    }).start();
  }, [copied, v]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ width: 13, height: 13 }}>
        <Animated.View
          style={{
            position: "absolute",
            opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
            ],
          }}
        >
          <CheckGlyph color={C.up} />
        </Animated.View>
        <Animated.View
          style={{
            position: "absolute",
            opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] }) },
            ],
          }}
        >
          <CopyGlyph color={C.dim} />
        </Animated.View>
      </View>
      {label ? (
        <Mono
          size={9.5}
          color={copied ? C.up : C.dim}
          style={{ letterSpacing: 1.4, fontFamily: F.mono }}
        >
          {copied ? "COPIED" : label}
        </Mono>
      ) : null}
    </View>
  );
}

/**
 * A whole surface that copies when pressed, with the mark on its trailing
 * edge. `children` owns the value's typography — this only owns the gesture,
 * the seat and the feedback.
 */
export function CopyField({
  onPress,
  copied,
  label,
  children,
  accessibilityLabel,
  style,
}: {
  onPress: () => void;
  copied: boolean;
  /** Resting caption beside the mark. Omit for mark-only rows. */
  label?: string;
  children: React.ReactNode;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(v, {
      toValue: value,
      useNativeDriver: true,
      speed: 44,
      bounciness: 3,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(0.985)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: copied ? "rgba(124,231,176,0.4)" : C.border,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
            transform: [{ scale: v }],
          },
          style,
        ]}
      >
        <View style={{ flex: 1 }}>{children}</View>
        <CopyMark copied={copied} label={label} />
      </Animated.View>
    </Pressable>
  );
}
