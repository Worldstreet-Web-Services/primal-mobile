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

import { MetalButton } from "../components/ui";
import { C, F } from "../theme/tokens";

const HERO = require("../../assets/images/logo.png");
/** The gold artwork's own ratio — width drives, height follows. */
const HERO_ASPECT = 1100 / 1326;
/**
 * The gold is drawn off-center inside its own file: 122px of transparent margin
 * on the left, none on the right (the export clips the third bar at the canvas
 * edge). Centering the *file* therefore hangs the mark to the right of the
 * wordmark below it. This is how far off center the drawn pixels sit, as a
 * fraction of the width, so the layout can center the object instead.
 */
const HERO_BIAS = 0.055;

/**
 * Gold bloom behind the hero. The mark is a rendered metal object; on flat
 * charcoal with no light around it, it reads as a sticker. This is the light it
 * is standing in, which is why it is the only ornament on the screen.
 */
function Bloom({ size }: { size: number }) {
  return (
    <Image
      source={require("../../assets/images/star_behind.png")}
      contentFit="cover"
      style={{
        width: size * 2,
        height: size * 2,
        position: "absolute",
        top: 0,
      }}
    />
  );
}

/**
 * The pitch, and nothing else.
 *
 * This screen answers one question — *what is this* — so it carries one action.
 * It used to offer a method choice and an "I already have an account" door as
 * well, which made it compete with the sign-in screen and left a returning user
 * picking between two routes to the same place. The method choice lives one
 * screen on; the reassurance for returning members is a line of copy, not a
 * second button.
 *
 * The entry is deliberately short. A pitch screen a returning member has seen
 * fifty times must not hold them: everything is on screen inside a second, and
 * the CTA is live from the first frame.
 */
export default function WelcomeScreen({
  onLogin,
}: {
  /** Into the method surface — KingsChat, Google, email. */
  onLogin?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const heroW = Math.min(width * 0.35, 180);

  const mark = useRef(new Animated.Value(0)).current;
  // One driver for the whole stack below the mark; each line reads a different
  // slice of it, which is what makes them arrive staggered off one animation.
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mark, {
      toValue: 1,
      duration: 820,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();

    Animated.timing(copy, {
      toValue: 1,
      duration: 820,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mark, copy]);

  /** Slice `copy` into a rise-and-fade for the nth line down the stack. */
  const step = (i: number) => {
    const start = i * 0.13;
    const range = [start, Math.min(start + 0.5, 1)];
    return {
      opacity: copy.interpolate({
        inputRange: range,
        outputRange: [0, 1],
        extrapolate: "clamp" as const,
      }),
      transform: [
        {
          translateY: copy.interpolate({
            inputRange: range,
            outputRange: [18, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvas,
        paddingTop: insets.top,
        paddingHorizontal: 26,
        paddingBottom: Math.max(insets.bottom, 26) + 8,
        position: "relative",
      }}
    >
      {/* Bloom sits behind everything — first sibling, so it is below the whole
          stack in z-order.

          The wrapper is not decoration: pinned left/right/top with no height,
          Yoga sizes this to the artwork's intrinsic ratio, which is ~850pt tall
          on an 874pt screen — it lies directly over the CTA. `pointerEvents` on
          expo-image is not reliably forwarded to its native view, so the image
          swallowed every tap on "Get started" and the button looked dead. A
          plain View honours it, so the rays stay decorative. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <Image
          source={require("../../assets/images/star_behind.png")}
          contentFit="contain"
          style={{ width: "100%", aspectRatio: 660 / 1395 }}
        />
      </View>

      {/* The mark holds the upper two thirds alone — the composition is one
          object in light, then the words, then the way in. */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: mark,
            transform: [
              {
                scale: mark.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.06, 1],
                }),
              },
            ],
          }}
        >
          <Image
            source={HERO}
            contentFit="contain"
            style={{
              width: heroW,
              height: heroW / HERO_ASPECT,
              transform: [{ translateX: -HERO_BIAS * heroW }],
            }}
            accessibilityLabel="KashPlus"
          />
        </Animated.View>

        {/* Sentence case, large and tight, directly under the mark. It lives
            INSIDE the centred block on purpose: parked outside it, the flex
            space opened up between the mark and the name and the lockup came
            apart down the middle of the screen. */}
        <Animated.View style={[{ marginTop: -4 }, step(0)]}>
          <Text
            style={{
              fontFamily: F.display,
              fontSize: 46,
              lineHeight: 54,
              letterSpacing: -0.6,
              color: C.text,
              textAlign: "center",
            }}
          >
            KashPlus
          </Text>
        </Animated.View>
      </View>

      {/* One action. The pitch does not ask the user to choose anything — the
          methods live on the next screen, which is the screen whose whole job
          is that choice. */}
      <Animated.View style={step(1)}>
        <MetalButton label="Get started" onPress={onLogin} />
      </Animated.View>
    </View>
  );
}
