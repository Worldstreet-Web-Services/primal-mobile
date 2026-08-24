import React, { useEffect, useMemo } from "react";
import { Animated, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
import { Body, Label, Mono, PressableScale, PulseDot } from "../ui";
import { cn } from "@/lib/cn";

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
      className={cn(
        "border items-center justify-center overflow-hidden",
        stable ? "bg-up-tint" : "bg-canvas-inset",
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderColor: stable ? "rgba(124,231,176,0.3)" : C.hairline,
      }}
    >
      <View
        pointerEvents="none"
        className="absolute top-[0px] left-[7px] right-[7px] h-[1px]"
        style={{
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />
      <Mono
        size={symbol.length > 3 ? 8.5 : 10}

        className={cn(
          "font-mono-semibold tracking-[0.2px]",
          stable ? "text-up" : "text-silver",
        )}
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
      className="flex-row items-center gap-[5px] px-[8px] py-[4px] rounded-[7px] border"
      style={{
        backgroundColor: tone === "warn" ? "rgba(245,184,61,0.1)" : C.inset,
        borderColor: tone === "warn" ? "rgba(245,184,61,0.28)" : C.hairline,
      }}
    >
      {pulse ? <PulseDot color={fg} size={5} /> : null}
      <Mono className="text-[9px] tracking-[1.3px]" color={fg}>
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
      className="flex-row items-center justify-between min-h-[18px]"
      style={style}
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
      className="flex-row items-center gap-[13px] py-[14px] border-b-rule"
      style={{
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <AssetDisc symbol={symbol} stable={stable} />
      <View className="flex-1">
        <Body className="text-[13.5px]" semibold>
          {name}
        </Body>
        <Mono className="text-[11px] text-dim mt-[3px]">{sub}</Mono>
      </View>
      <View className="items-end">
        <Mono className="text-[13.5px] text-text font-mono-semibold">
          {value}
        </Mono>
        {meta ? (
          <Mono
            size={11}
            color={
              metaTone === "up" ? C.up : metaTone === "down" ? C.down : C.dim
            }
            className="mt-[3px]"
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
  const v = useMemo(() => new Animated.Value(0.4), []);

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
      className="bg-canvas-inset"
      style={[
        {
          width,
          height,
          borderRadius: radius,
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
      className="flex-row items-center gap-[13px] py-[14px] border-b-rule"
      style={{
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <PulseBlock width={40} height={40} radius={20} />
      <View className="flex-1 gap-[7px]">
        <PulseBlock width={112} height={12} />
        <PulseBlock width={68} height={10} />
      </View>
      <View className="items-end gap-[7px]">
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
      className="bg-canvas-raised rounded-[18px] border border-rule px-[16px] overflow-hidden"
      style={style}
    >
      <View
        pointerEvents="none"
        className="absolute top-[0px] left-[14px] right-[14px] h-[1px]"
        style={{
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
      className="flex-row items-center justify-between gap-[16px] py-[13px] border-b-rule"
      style={{
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <Body className="text-[12.5px] text-sub">{label}</Body>
      <Mono
        className="text-[12.5px] text-text"

        style={strong ? { fontFamily: F.monoSemibold } : undefined}
      >
        {value}
        {tail ? <Mono className="text-[12.5px] text-dim"> {tail}</Mono> : null}
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
  const v = useMemo(() => new Animated.Value(0), []);

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
