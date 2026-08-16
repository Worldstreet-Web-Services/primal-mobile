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

import { MetalButton } from "../components/ui";
import { C, F } from "../theme/tokens";

const HERO = require("../../assets/images/paradigm_logo.png");
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
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      style={{ position: "absolute" }}
    >
      <Defs>
        <RadialGradient id="welcome-bloom" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={C.amber} stopOpacity={0.16} />
          <Stop offset="0.5" stopColor={C.amber} stopOpacity={0.05} />
          <Stop offset="1" stopColor={C.amber} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={size / 2}
        cy={size / 2}
        rx={size / 2}
        ry={size / 2}
        fill="url(#welcome-bloom)"
      />
    </Svg>
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
export default function WelcomeScreen({ onLogin }: { onLogin?: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const heroW = Math.min(width * 0.54, 230);
  const bloom = heroW * 2.6;

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
      }}
    >
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
          <Bloom size={bloom} />
          <Image
            source={HERO}
            contentFit="contain"
            style={{
              width: heroW,
              height: heroW / HERO_ASPECT,
              transform: [{ translateX: -HERO_BIAS * heroW }],
            }}
            accessibilityLabel="Paradigm"
          />
        </Animated.View>
      </View>

      <Animated.View style={step(0)}>
        <Text
          style={{
            fontFamily: F.display,
            fontSize: 26,
            letterSpacing: 9,
            // Tracking adds its space after the last letter, which walks
            // centered type half a step left. Push it back.
            marginLeft: 4.5,
            color: C.text,
            textAlign: "center",
          }}
        >
          PARADIGM
        </Text>
      </Animated.View>

      <Animated.View style={[{ marginTop: 18 }, step(1)]}>
        <Text
          style={{
            fontFamily: F.body,
            fontSize: 16,
            lineHeight: 25,
            color: C.sub,
            textAlign: "center",
          }}
        >
          Markets, capital and payments {"—"} in one account.
        </Text>
      </Animated.View>

      <Animated.View style={[{ marginTop: 46 }, step(2)]}>
        <MetalButton label="Get started" onPress={onLogin} />
      </Animated.View>

      {/* The returning member's answer. It is a sentence rather than a second
          button because there is no second destination — the same door creates
          a wallet or restores one. */}
      <Animated.View style={[{ marginTop: 18 }, step(3)]}>
        <Text
          style={{
            fontFamily: F.body,
            fontSize: 12.5,
            lineHeight: 18,
            color: C.dim,
            textAlign: "center",
          }}
        >
          New or returning {"—"} you start in the same place.
        </Text>
      </Animated.View>
    </View>
  );
}
