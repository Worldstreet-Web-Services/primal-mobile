import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KashPlusMark } from "@/components/KashPlusMark";
import { BrandLoading } from "../components/BrandLoading";
import { MetalButton } from "../components/ui";
import { C, F } from "../theme/tokens";

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
  const enter = useRef(new Animated.Value(0)).current;
  const crown = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(crown, {
        toValue: 1,
        duration: 760,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
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
    ]);
    anim.start();
    return () => anim.stop();
  }, [enter, crown]);

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
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
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
        style={{
          flex: 1,
          paddingHorizontal: 26,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, 26) + 8,
          alignItems: "center",
        }}
      >
        <Animated.View
          style={[
            { flexDirection: "row", alignItems: "center", gap: 10 },
            step(0),
          ]}
        >
          <KashPlusMark height={30} color={C.text} />
          <Text
            style={{
              fontFamily: F.displayBold,
              fontSize: 31,
              letterSpacing: -0.6,
              color: C.text,
            }}
          >
            KashPlus
          </Text>
        </Animated.View>

        {/* The crown owns the upper frame — it is the thing being awarded, so it
            arrives first and alone, and the sentence lands underneath it. */}
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Animated.View
            style={{
              alignItems: "center",
              justifyContent: "center",
              opacity: crown,
              transform: [
                {
                  // Settles down onto the screen rather than rising into it: a
                  // crown is placed, not launched.
                  translateY: crown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-26, 0],
                  }),
                },
                {
                  scale: crown.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.86, 1],
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

        <Animated.View style={[{ alignItems: "center" }, step(0)]}>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 38,
              letterSpacing: -0.4,
              color: C.silver,
              textAlign: "center",
            }}
            className="font-medium"
          >
            Welcome to{" "}
            <Text style={{ color: C.text }} className="font-bold">
              KashPlus
            </Text>
          </Text>
        </Animated.View>

        <Animated.View style={[{ alignItems: "center" }, step(1)]}>
          <Text
            style={{
              fontFamily: F.body,
              fontSize: 14,
              lineHeight: 21,
              color: C.sub,
              textAlign: "center",
              marginTop: 12,
              maxWidth: 240,
            }}
          >
            You&apos;ve earned your place among the 1% who see things
            differently.
          </Text>
        </Animated.View>

        {/* Air between the sentence and the way out, so the copy reads as the
            screen and the button as the exit — not as one block. */}
        <View style={{ height: 100 }} />

        <Animated.View style={step(2)} className={"self-stretch"}>
          <MetalButton label="Continue" onPress={onContinue} loading={busy} />
        </Animated.View>
      </View>

      {/* Last sibling, so it covers the rays, the copy and the CTA alike. */}
      <BrandLoading visible={busy} label="Preparing your account" />
    </View>
  );
}
