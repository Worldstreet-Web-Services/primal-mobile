import React, { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
import { Body, Label, Mono, PressableScale, PulseDot } from "../ui";

// The crypto space's shared anatomy. Holdings, the withdraw picker and the buy
// list are the same instrument seen three times, so the row, the state tag and
// the quote card live here rather than being re-cut per screen.

/**
 * Machined asset disc. No token artwork ships yet, so the symbol is set into a
 * milled plate — hairline edge, one highlight along the top — which keeps the
 * list consistent instead of leaving holes where logos would be.
 */
export function AssetDisc({
  symbol,
  stable = false,
  size = 40,
}: {
  symbol: string;
  /** Dollar-pegged: the row's figure is money, so the plate carries `up`. */
  stable?: boolean;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: stable ? C.upBg : C.inset,
        borderWidth: 1,
        borderColor: stable ? "rgba(240,199,90,0.3)" : C.hairline,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 7,
          right: 7,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />
      <Mono
        size={symbol.length > 3 ? 8.5 : 10}
        color={stable ? C.up : C.silver}
        style={{ fontFamily: F.monoSemibold, letterSpacing: 0.2 }}
      >
        {symbol}
      </Mono>
    </View>
  );
}

export type ChipTone = "quiet" | "live" | "warn";

/**
 * Small machined tag for a surface's state — "offline preview", "reading
 * chains". Squared rather than pilled so it reads as a stamped plate beside
 * the label it qualifies, not as another button.
 */
export function MetaChip({
  label,
  tone = "quiet",
  pulse = false,
}: {
  label: string;
  tone?: ChipTone;
  /** Breathing dot for work in flight. */
  pulse?: boolean;
}) {
  const fg = tone === "warn" ? C.amber : tone === "live" ? C.silver : C.dim;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 7,
        backgroundColor: tone === "warn" ? "rgba(245,184,61,0.1)" : C.inset,
        borderWidth: 1,
        borderColor: tone === "warn" ? "rgba(245,184,61,0.28)" : C.hairline,
      }}
    >
      {pulse ? <PulseDot color={fg} size={5} /> : null}
      <Mono size={9} color={fg} style={{ letterSpacing: 1.3 }}>
        {label.toUpperCase()}
      </Mono>
    </View>
  );
}

/** Section rule: tracked label on the left, a quiet fact or tag on the right. */
export function SectionHead({
  label,
  right,
  style,
}: {
  label: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 18,
        },
        style,
      ]}
    >
      <Label>{label}</Label>
      {right}
    </View>
  );
}

export type MetaTone = "dim" | "up" | "down";

/**
 * One instrument line: what it is on the left, what it is worth on the right.
 * Both columns stack the same way — headline over a dim second line — so a
 * list can be read straight down either edge.
 */
export function InstrumentRow({
  symbol,
  name,
  sub,
  value,
  meta,
  metaTone = "dim",
  stable = false,
  onPress,
  last = false,
  accessibilityLabel,
}: {
  symbol: string;
  name: string;
  /** Left second line — the holding's quantity, or its ticker. */
  sub: string;
  /** Right headline: the money figure. */
  value: string;
  /** Right second line — unit price, network, or a 24h move. */
  meta?: string;
  metaTone?: MetaTone;
  stable?: boolean;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <AssetDisc symbol={symbol} stable={stable} />
      <View style={{ flex: 1 }}>
        <Body size={13.5} semibold>
          {name}
        </Body>
        <Mono size={11} color={C.dim} style={{ marginTop: 3 }}>
          {sub}
        </Mono>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Mono size={13.5} color={C.text} style={{ fontFamily: F.monoSemibold }}>
          {value}
        </Mono>
        {meta ? (
          <Mono
            size={11}
            color={
              metaTone === "up" ? C.up : metaTone === "down" ? C.down : C.dim
            }
            style={{ marginTop: 3 }}
          >
            {meta}
          </Mono>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      scale={0.99}
      accessibilityLabel={accessibilityLabel}
    >
      {body}
    </PressableScale>
  );
}

const PULSE_MS = 900;

/**
 * Placeholder block that breathes while real figures are on the wire. A
 * skeleton in the shape of the content says what is coming; a spinner doesn't
 * — and a canned number in the meantime would be a lie.
 */
export function PulseBlock({
  width,
  height,
  radius = 6,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.85,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.4,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: C.inset,
          opacity: v,
        },
        style,
      ]}
    />
  );
}

/** A row skeleton cut to `InstrumentRow`'s measurements. */
export function RowSkeleton({ last = false }: { last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <PulseBlock width={40} height={40} radius={20} />
      <View style={{ flex: 1, gap: 7 }}>
        <PulseBlock width={112} height={12} />
        <PulseBlock width={68} height={10} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 7 }}>
        <PulseBlock width={64} height={12} />
        <PulseBlock width={44} height={10} />
      </View>
    </View>
  );
}

export function RowSkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} last={i === rows - 1} />
      ))}
    </View>
  );
}

/** The framed surface a quote is set into — one shine, hairline edge. */
export function QuoteCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.raised,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: C.hairline,
          paddingHorizontal: 16,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 14,
          right: 14,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      />
      {children}
    </View>
  );
}

/** One term of a quote: the name in body, the figure in mono on the right. */
export function QuoteRow({
  label,
  value,
  tail,
  strong = false,
  last = false,
}: {
  label: string;
  value: string;
  /** Dim qualifier after the figure — "· sponsored", "· in quote". */
  tail?: string;
  /** The line that settles the deal: total debit, amount sent. */
  strong?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <Body size={12.5} color={C.sub}>
        {label}
      </Body>
      <Mono
        size={12.5}
        color={C.text}
        style={strong ? { fontFamily: F.monoSemibold } : undefined}
      >
        {value}
        {tail ? (
          <Mono size={12.5} color={C.dim}>
            {" "}
            {tail}
          </Mono>
        ) : null}
      </Mono>
    </View>
  );
}

/**
 * The one motion moment a screen is allowed: content arriving settled rather
 * than snapping in. Deliberately small — 10px and a fade.
 */
export function Settle({
  children,
  delay = 0,
  distance = 10,
  duration = 420,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [v, delay, duration]);

  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
