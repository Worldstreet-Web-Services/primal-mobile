import React, { useEffect, useMemo } from "react";
import {
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { Body, Mono, PressableScale } from "@/components/ui";
import { formatUsd, truncateAddress } from "@/lib/vault/format";
import { useVaultStore } from "@/store/vault";
import { C, withAlpha } from "@/theme/tokens";
import { cn } from "@/lib/cn";

// Confetti in the house palette — the money-in green for the win, brand and
// chrome for sparkle. Amber stays out of it: on this screen amber is the clock.
const confetti = () => [C.up, C.brand, "#FFFFFF", C.silver];

function Particle({ index, total }: { index: number; total: number }) {
  const { width, height } = useWindowDimensions();
  const progress = useMemo(() => new Animated.Value(0), []);

  // Deterministic fan-out per index with a little jitter.
  const angle = (index / total) * Math.PI * 2 + (index % 3) * 0.35;
  const distance = 120 + ((index * 37) % 140);
  const size = 6 + ((index * 13) % 8);
  const palette = confetti();
  const color = palette[index % palette.length];

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 1400 + ((index * 53) % 600),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, progress]);

  // cos/sin are per-particle constants, so the drift is plain multiplication;
  // the squared term is gravity bending the arc downward.
  return (
    <Animated.View
      pointerEvents="none"
      className="absolute rounded-[2px]"
      style={{
        left: width / 2 - size / 2,
        top: height / 2 - size / 2,
        width: size,
        height: size * 0.6,
        backgroundColor: color,
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        }),
        transform: [
          {
            translateX: Animated.multiply(progress, Math.cos(angle) * distance),
          },
          {
            translateY: Animated.add(
              Animated.multiply(progress, Math.sin(angle) * distance),
              Animated.multiply(Animated.multiply(progress, progress), 60),
            ),
          },
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", `${180 + ((index * 29) % 240)}deg`],
            }),
          },
        ],
      }}
    />
  );
}

/** The house crown — drawn, not an emoji, so it wears the palette. */
function CrownMark({ color, size = 26 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2.8 8 L7.6 11.4 L12 4.6 L16.4 11.4 L21.2 8 L19.4 18 H4.6 Z"
        fill={color}
      />
      <Rect x="4.6" y="19.3" width="14.8" height="1.7" rx="0.85" fill={color} />
    </Svg>
  );
}

function SpinnerRing() {
  const turn = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  return (
    <Animated.View
      className="w-[84px] h-[84px] rounded-[42px] border-rule border-t-silver"
      style={{
        borderWidth: 2,
        transform: [
          {
            rotate: turn.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "360deg"],
            }),
          },
        ],
      }}
    />
  );
}

/** Full-screen dim that fades itself in on mount. */
function Dim({ children }: { children: React.ReactNode }) {
  const v = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [v]);
  return (
    <Animated.View
      className="absolute top-[0px] left-[0px] right-[0px] bottom-[0px] items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.82)",
        opacity: v,
      }}
    >
      {children}
    </Animated.View>
  );
}

export function RoundOverlay({ myAddress }: { myAddress: string | null }) {
  const phase = useVaultStore((s) => s.phase);
  const dismiss = useVaultStore((s) => s.dismissReveal);

  const particles = useMemo(() => Array.from({ length: 36 }, (_, i) => i), []);
  const pop = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (phase.kind === "reveal") {
      pop.setValue(0);
      Animated.spring(pop, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 7,
      }).start();
    }
  }, [phase.kind, pop]);

  if (phase.kind === "idle") return null;

  if (phase.kind === "calculating") {
    return (
      <Dim>
        <View className="items-center">
          <View className="items-center justify-center">
            <SpinnerRing />
            <View className="absolute">
              <CrownMark color={C.dim} size={28} />
            </View>
          </View>
          <Mono className="text-[9.5px] text-dim mt-[26px] tracking-[2.2px]">
            SETTLING THE ROUND
          </Mono>
          <Text className="mt-[12px] font-display text-[20px] text-text">
            Deciding who stood last
          </Text>
          <View className="flex-row items-end gap-[7px] mt-[12px]">
            <Text className="font-mono-semibold text-[15px] text-silver">
              {formatUsd(phase.potUsd)}
            </Text>
            <Body className="text-[12.5px] text-dim">on the line</Body>
          </View>
        </View>
      </Dim>
    );
  }

  const youWon =
    myAddress !== null &&
    phase.winner.toLowerCase() === myAddress.toLowerCase();

  return (
    <Dim>
      {youWon
        ? particles.map((i) => (
            <Particle key={i} index={i} total={particles.length} />
          ))
        : null}

      <Animated.View
        className="mx-[32px] items-center rounded-[28px] border bg-canvas-raised px-[32px] py-[32px]"
        style={{
          borderColor: youWon ? withAlpha(C.up, 0.32) : C.hairline,
          opacity: pop,
          transform: [
            {
              scale: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [0.82, 1],
              }),
            },
          ],
        }}
      >
        <View
          className={cn(
            "w-[56px] h-[56px] rounded-[28px] items-center justify-center border",
            youWon ? "bg-up-tint" : "bg-canvas-inset",
          )}
          style={{
            borderColor: youWon ? withAlpha(C.up, 0.32) : C.hairline,
          }}
        >
          <CrownMark color={youWon ? C.up : C.silver} size={26} />
        </View>
        <Mono
          size={9.5}

          className={cn(
            "mt-[18px] tracking-[2.4px]",
            youWon ? "text-up" : "text-dim",
          )}
        >
          {youWon ? "THE POT IS YOURS" : "ROUND SETTLED"}
        </Mono>
        <Text className="mt-[10px] text-center font-display-bold text-[22px] text-text">
          {youWon ? "You stood last" : truncateAddress(phase.winner)}
        </Text>
        <Text
          className={cn(
            "mt-[12px] text-center font-mono-semibold text-[32px] tracking-[-0.5px]",
            youWon ? "text-up" : "text-text",
          )}
        >
          {formatUsd(phase.prizeUsd)}
        </Text>
        <Body className="text-[12px] text-dim mt-[12px] text-center leading-[18px]">
          {youWon
            ? "The winner's cut is on its way to your wallet."
            : "Took the winner's half. Open a table and build the next pot."}
        </Body>
        <View className="mt-[26px]">
          <PressableScale onPress={dismiss} scale={0.97}>
            <View
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              className="rounded-[999px] border border-border bg-key px-[44px] py-[14px]"
            >
              <Text className="font-mono-semibold text-[11.5px] tracking-[1.6px] text-text">
                {youWon ? "DONE" : "GOT IT"}
              </Text>
            </View>
          </PressableScale>
        </View>
      </Animated.View>
    </Dim>
  );
}
