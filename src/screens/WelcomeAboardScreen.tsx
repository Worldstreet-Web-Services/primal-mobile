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
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { BrandLoading } from "../components/BrandLoading";
import { MetalButton } from "../components/ui";
import { C, F } from "../theme/tokens";

const RAYS = require("../../assets/images/star_behind.png");
const CROWN = require("../../assets/images/golden_crown.png");
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

/**
 * The light the crown stands in. A rendered gold object on a near-flat ground
 * reads as a sticker without one; the middle stop is what keeps the falloff
 * from looking like a spotlight.
 */
function Glow({
  size,
  color,
  opacity,
}: {
  size: number;
  color: string;
  opacity: number;
}) {
  return (
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      <Defs>
        <RadialGradient id="aboard-crown-glow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.34} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={size / 2}
        cy={size / 2}
        rx={size / 2}
        ry={size / 2}
        fill="url(#aboard-crown-glow)"
      />
    </Svg>
  );
}

/**
 * The arrival beat.
 *
 * It is shown once, after the account exists, and it does exactly one thing:
 * tell a new member they are in. No summary, no next steps, no tour — those
 * belong to the app, and stacking them here would turn a moment into a form.
 *
 * The rays are the whole ornament. They are laid at 9% alpha in the artwork,
 * which on charcoal is a whisper, so the image is drawn twice over itself: two
 * passes bring the light up to roughly 18% without a second export and without
 * a gradient standing in for it. The eye of the burst is parked above the copy
 * so the words sit in the light rather than beside it.
 */
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
  const crownW = Math.min(width * 0.62, 260);

  // One driver for the whole stack; each element reads a different slice of it,
  // which is what makes them arrive staggered off a single animation.
  const enter = useRef(new Animated.Value(0)).current;
  /**
   * The crown has its own driver rather than a slice of `enter`, because it
   * moves differently: it settles DOWN into place with a slight scale while
   * everything below rises up into place. Sharing one curve would force both to
   * travel the same way.
   */
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
    // No padding on the root: the rays have to reach all four edges, and an
    // absolutely-positioned child is still offset by its parent's padding, so
    // padding here would inset the ground. The content carries its own instead.
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      {/* The wrapper is load-bearing: expo-image does not reliably forward
          `pointerEvents` to its native view, so a full-bleed copy laid straight
          into the tree swallows every tap on the CTA beneath it and the button
          looks dead. A plain View honours it, which keeps the rays
          decorative. */}
      <View pointerEvents="none" style={raysBox}>
        <Image
          source={RAYS}
          contentFit="fill"
          style={{ width: raysW, height: raysH }}
        />
        {/* Second pass, exactly registered on the first — see the note above. */}
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
        }}
      >
        {/* The crown owns the upper frame — it is the thing being awarded, so it
            arrives first and alone, and the sentence lands underneath it. */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
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
            <Glow size={crownW * 2} color={C.brand} opacity={0.2} />
            <Image
              source={CROWN}
              contentFit="contain"
              style={{ width: crownW, height: crownW / CROWN_ASPECT }}
              accessibilityLabel="Paradigm membership"
            />
          </Animated.View>
        </View>

        <Animated.View style={[{ alignItems: "center" }, step(0)]}>
          <Text
            style={{
              fontFamily: F.displayBold,
              fontSize: 30,
              lineHeight: 38,
              letterSpacing: -0.4,
              color: C.text,
              textAlign: "center",
            }}
          >
            Welcome to <Text style={{ color: C.silver }}>Paradigm!</Text>
          </Text>
        </Animated.View>

        <Animated.View style={[{ alignItems: "center" }, step(1)]}>
          {/* Held to a width that breaks the sentence into two lines on every
              handset we ship to. A hard newline would break it into three on
              the small ones. */}
          <Text
            style={{
              fontFamily: F.body,
              fontSize: 14,
              lineHeight: 21,
              color: C.sub,
              textAlign: "center",
              marginTop: 12,
              maxWidth: 300,
            }}
          >
            You&apos;ve earned your place among the few who see things
            differently.
          </Text>
        </Animated.View>

        {/* Air between the sentence and the way out, so the copy reads as the
            screen and the button as the exit — not as one block. */}
        <View style={{ height: 46 }} />

        <Animated.View style={step(2)}>
          <MetalButton label="Continue" onPress={onContinue} loading={busy} />
        </Animated.View>
      </View>

      {/* Last sibling, so it covers the rays, the copy and the CTA alike. */}
      <BrandLoading visible={busy} label="Preparing your account" />
    </View>
  );
}
