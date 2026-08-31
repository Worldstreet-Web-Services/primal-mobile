import { Image } from "expo-image";
import { useEffect, useMemo } from "react";
import {
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLoading } from "@/components/BrandLoading";
import { KashPlusMark } from "@/components/KashPlusMark";
import { MetalButton } from "@/components/ui";
import { C } from "@/theme/tokens";

const RAYS = require("@/assets/images/star_behind.png");
const CROWN = require("@/assets/images/crown.png");
/** The crown artwork's own ratio (563x418) — width drives, height follows. */
const CROWN_ASPECT = 563 / 418;
/** The ray artwork's own ratio — it is drawn tall and bleeds off the bottom. */
const RAYS_ASPECT = 660 / 1395;

/**
 * Where the rays converge, as a fraction of the artwork's height. The burst is
 * drawn off-centre in its own file, so anchoring the layout to the file's top
 * would put the light source wherever the export happened to leave it. This is
 * the number the composition is actually built on.
 */
const RAYS_EYE = 0.34;
/** Where that eye should land on the screen, as a fraction of screen height. */
const EYE_ON_SCREEN = 0.3;
/**
 * How much wider than the screen the artwork is drawn. At 1.0 the rays run out
 * of image before they run out of screen and the fan ends in a hard horizontal
 * cut just above the CTA; oversized, every ray leaves through an edge.
 */
const RAYS_OVERSCAN = 1.35;

export default function WelcomeAboardScreen({
  onContinue,
  /**
   * Covers the screen with the brand wait. Set it while the hand-off does real
   * work — the entitlement sync that has to land before the app is usable — so
   * the member never presses Continue into a dead screen.
   */
  busy = false,
}: {
  onContinue?: () => void;
  busy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Laid out in points rather than percentages: a percentage `top` resolves
  // against the parent's HEIGHT while the artwork is sized off WIDTH, so the
  // eye would drift with the aspect ratio of the handset.
  const raysW = width * RAYS_OVERSCAN;
  const raysH = raysW / RAYS_ASPECT;
  const raysBox = {
    position: "absolute" as const,
    width: raysW,
    height: raysH,
    left: (width - raysW) / 2,
    top: height * EYE_ON_SCREEN - raysH * RAYS_EYE,
  };

  /** Crown width. Capped so it stays an object on the screen, not a backdrop. */
  const crownW = Math.min(width * 0.92, 350);
  const enter = useMemo(() => new Animated.Value(0), []);
  const crown = useMemo(() => new Animated.Value(0), []);
  /** The idle bob, held separately so it can run forever under the entrance. */
  const drift = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const anim = Animated.parallel([
      // Spring rather than a curve: the crown zooms up from small and passes
      // its resting size by ~6% before settling. Damping 16 against stiffness
      // 150 is a ratio of 0.65 — one visible bounce, not a wobble, and the
      // whole thing is at rest inside half a second.
      Animated.spring(crown, {
        toValue: 1,
        stiffness: 150,
        damping: 16,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(enter, {
        toValue: 1,
        duration: 900,
        // Held back so the crown lands first and the words follow it, rather
        // than the whole screen arriving at once.
        delay: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // The bob, forever. Delayed past the spring's settle so the two are
      // never moving the crown at once — the entrance finishes, THEN it
      // breathes. `sin` in and out both ways: a linear bob has a corner at the
      // top and bottom of its travel and reads as a twitch.
      Animated.sequence([
        Animated.delay(700),
        Animated.loop(
          Animated.sequence([
            Animated.timing(drift, {
              toValue: 1,
              duration: 1600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(drift, {
              toValue: 0,
              duration: 1600,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ),
      ]),
    ]);
    anim.start();
    return () => anim.stop();
  }, [enter, crown, drift]);

  /** Slice `enter` into a rise-and-fade for the nth element down the screen. */
  const step = (i: number) => {
    const start = i * 0.14;
    const range = [start, Math.min(start + 0.5, 1)];
    return {
      opacity: enter.interpolate({
        inputRange: range,
        outputRange: [0, 1],
        extrapolate: "clamp" as const,
      }),
      transform: [
        {
          translateY: enter.interpolate({
            inputRange: range,
            outputRange: [18, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* BACKGROUND RAY */}
      <View pointerEvents="none" style={raysBox}>
        <Image
          source={RAYS}
          contentFit="fill"
          style={{ width: raysW, height: raysH, opacity: 0.4 }}
        />
        <Image
          source={RAYS}
          contentFit="fill"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: raysW,
            height: raysH,
          }}
        />
      </View>

      <View
        className="flex-1 px-[26px] items-center"
        style={{
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 26) + 8,
        }}
      >
        <Animated.View
          className="flex-row items-center gap-[10px]"
          style={step(0)}
        >
          <KashPlusMark height={30} color={C.text} />
          <Text className="font-display-bold text-[31px] tracking-[-0.6px] text-text">
            KashPlus
          </Text>
        </Animated.View>

        {/* The crown owns the upper frame — it is the thing being awarded, so it
            arrives first and alone, and the sentence lands underneath it. */}
        <View className="flex-1 items-center justify-center">
          <Animated.View
            className="items-center justify-center"
            style={{
              // Clamped, and done well before the spring is: the crown should
              // be fully opaque while it is still growing, so what reads is a
              // zoom and not a fade.
              opacity: crown.interpolate({
                inputRange: [0, 0.35],
                outputRange: [0, 1],
                extrapolate: "clamp" as const,
              }),
              transform: [
                {
                  // Settles down onto the screen rather than rising into it: a
                  // crown is placed, not launched.
                  translateY: crown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-14, 0],
                  }),
                },
                {
                  // The idle bob, summed with the placement translate above.
                  // Five points of travel over three and a bit seconds — at
                  // this size it should be felt rather than watched.
                  translateY: drift.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -5],
                  }),
                },
                {
                  // NOT clamped, unlike the opacity above — the spring drives
                  // `crown` past 1, and it is that overshoot mapped through
                  // here that gives the zoom its little kick at the top.
                  scale: crown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.55, 1],
                  }),
                },
              ],
            }}
          >
            <Image
              source={CROWN}
              contentFit="contain"
              style={{ width: crownW, height: crownW / CROWN_ASPECT }}
              accessibilityLabel="KashPlus membership"
            />
          </Animated.View>
        </View>

        <Animated.View className="items-center" style={step(0)}>
          <Text className="text-center font-body-medium text-[30px] leading-[38px] tracking-[-0.4px] text-silver">
            Welcome to{" "}
            <Text className="font-display-bold text-text">KashPlus</Text>
          </Text>
        </Animated.View>

        <Animated.View className="items-center" style={step(1)}>
          <Text className="font-body text-[14px] leading-[21px] text-sub text-center mt-[12px] max-w-[240px]">
            You&apos;ve earned your place among the 1% who see things
            differently.
          </Text>
        </Animated.View>

        {/* Air between the sentence and the way out, so the copy reads as the
            screen and the button as the exit — not as one block. */}
        <View className="h-[100px]" />

        <Animated.View style={step(2)} className={"self-stretch"}>
          <MetalButton label="Continue" onPress={onContinue} loading={busy} />
        </Animated.View>
      </View>

      {/* Last sibling, so it covers the rays, the copy and the CTA alike. */}
      <BrandLoading visible={busy} label="Preparing your account" />
    </View>
  );
}
