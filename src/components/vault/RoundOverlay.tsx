import React, { useEffect, useMemo, useRef } from "react";
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
import { C, F } from "@/theme/tokens";

// Confetti in the house palette — the money-in green for the win, brand and
// chrome for sparkle. Amber stays out of it: on this screen amber is the clock.
const CONFETTI = [C.up, C.brand, "#FFFFFF", C.silver];

function Particle({ index, total }: { index: number; total: number }) {
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  // Deterministic fan-out per index with a little jitter.
  const angle = (index / total) * Math.PI * 2 + (index % 3) * 0.35;
  const distance = 120 + ((index * 37) % 140);
  const size = 6 + ((index * 13) % 8);
  const color = CONFETTI[index % CONFETTI.length];

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
      style={{
        position: "absolute",
        left: width / 2 - size / 2,
        top: height / 2 - size / 2,
        width: size,
        height: size * 0.6,
        borderRadius: 2,
        backgroundColor: color,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [
          { translateX: Animated.multiply(progress, Math.cos(angle) * distance) },
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
  const turn = useRef(new Animated.Value(0)).current;
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
      style={{
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 2,
        borderColor: C.hairline,
        borderTopColor: C.silver,
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
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        justifyContent: "center",
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
  const pop = useRef(new Animated.Value(0)).current;

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
        <View style={{ alignItems: "center" }}>
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <SpinnerRing />
            <View style={{ position: "absolute" }}>
              <CrownMark color={C.dim} size={28} />
            </View>
          </View>
          <Mono
            size={9.5}
            color={C.dim}
            style={{ marginTop: 26, letterSpacing: 2.2 }}
          >
            SETTLING THE ROUND
          </Mono>
          <Text
            style={{
              marginTop: 12,
              fontFamily: F.display,
              fontSize: 20,
              color: C.text,
            }}
          >
            Deciding who stood last
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 7,
              marginTop: 12,
            }}
          >
            <Text
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 15,
                color: C.silver,
              }}
            >
              {formatUsd(phase.potUsd)}
            </Text>
            <Body size={12.5} color={C.dim}>
              on the line
            </Body>
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
        style={{
          marginHorizontal: 32,
          alignItems: "center",
          borderRadius: 28,
          borderWidth: 1,
          borderColor: youWon ? "rgba(240,199,90,0.32)" : C.hairline,
          backgroundColor: C.raised,
          paddingHorizontal: 32,
          paddingVertical: 32,
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
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: youWon ? C.upBg : C.inset,
            borderWidth: 1,
            borderColor: youWon ? "rgba(240,199,90,0.32)" : C.hairline,
          }}
        >
          <CrownMark color={youWon ? C.up : C.silver} size={26} />
        </View>
        <Mono
          size={9.5}
          color={youWon ? C.up : C.dim}
          style={{ marginTop: 18, letterSpacing: 2.4 }}
        >
          {youWon ? "THE POT IS YOURS" : "ROUND SETTLED"}
        </Mono>
        <Text
          style={{
            marginTop: 10,
            textAlign: "center",
            fontFamily: F.displayBold,
            fontSize: 22,
            color: C.text,
          }}
        >
          {youWon ? "You stood last" : truncateAddress(phase.winner)}
        </Text>
        <Text
          style={{
            marginTop: 12,
            textAlign: "center",
            fontFamily: F.monoSemibold,
            fontSize: 32,
            letterSpacing: -0.5,
            color: youWon ? C.up : C.text,
          }}
        >
          {formatUsd(phase.prizeUsd)}
        </Text>
        <Body
          size={12}
          color={C.dim}
          style={{ marginTop: 12, textAlign: "center", lineHeight: 18 }}
        >
          {youWon
            ? "The winner's cut is on its way to your wallet."
            : "Took the winner's half. Open a table and build the next pot."}
        </Body>
        <View style={{ marginTop: 26 }}>
          <PressableScale onPress={dismiss} scale={0.97}>
            <View
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.key,
                paddingHorizontal: 44,
                paddingVertical: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 11.5,
                  letterSpacing: 1.6,
                  color: C.text,
                }}
              >
                {youWon ? "DONE" : "GOT IT"}
              </Text>
            </View>
          </PressableScale>
        </View>
      </Animated.View>
    </Dim>
  );
}
