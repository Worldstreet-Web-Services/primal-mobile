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

import { GlassDrawer } from "../components/GlassDrawer";
import { Logo } from "../components/Logo";
import { PressableScale } from "../components/ui";
import { C, F } from "../theme/tokens";

/** Beat the drawer starts on — the mark gets the screen to itself until here. */
const DRAWER_DELAY = 620;

/** Soft leaf bloom behind the mark, so it sits in light instead of on flat black. */
function Bloom({ size }: { size: number }) {
  return (
    <Svg
      pointerEvents="none"
      width={size}
      height={size}
      style={{ position: "absolute" }}
    >
      <Defs>
        <RadialGradient id="bloom" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#83BE60" stopOpacity={0.22} />
          <Stop offset="0.55" stopColor="#83BE60" stopOpacity={0.07} />
          <Stop offset="1" stopColor="#83BE60" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={size / 2}
        cy={size / 2}
        rx={size / 2}
        ry={size / 2}
        fill="url(#bloom)"
      />
    </Svg>
  );
}

const ACCESS_VECTOR = require("../../assets/images/access_vector.png");

/**
 * Trailing glyph on the CTA. Tinted rather than drawn in its own colors, so it
 * always matches the label sitting beside it on the brand-filled button.
 */
function AccessGlyph({
  color = C.brandSoftInk,
  size = 20,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Image
      source={ACCESS_VECTOR}
      contentFit="contain"
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The membership pitch. The mark holds the screen alone for a beat, then the
 * glass drawer rises over its foot and the copy lands line by line behind it.
 */
export default function WelcomeScreen({
  onLogin,
}: {
  onLogin?: (method: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const logoW = Math.min(width * 0.78, 320);
  const bloom = logoW * 1.9;

  const mark = useRef(new Animated.Value(0)).current;
  // One driver for the whole copy stack; each line reads a different slice of
  // it, which is what makes them arrive staggered off a single animation.
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(mark, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();

    Animated.timing(copy, {
      toValue: 1,
      duration: 1100,
      delay: DRAWER_DELAY + 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mark, copy]);

  /** Slice `copy` into a rise-and-fade for the nth line down the stack. */
  const step = (i: number) => {
    const start = i * 0.11;
    const range = [start, Math.min(start + 0.42, 1)];
    return {
      opacity: copy.interpolate({
        inputRange: range,
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateY: copy.interpolate({
            inputRange: range,
            outputRange: [22, 0],
            extrapolate: "clamp",
          }),
        },
      ],
    };
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      {/* The mark sits high and gets clipped by the drawer at its foot —
          the overlap is the composition, not an accident of layout. */}
      <Animated.View
        style={{
          position: "absolute",
          top: insets.top + height * 0.1,
          left: 0,
          right: 0,
          alignItems: "center",
          opacity: mark,
          transform: [
            {
              scale: mark.interpolate({
                inputRange: [0, 1],
                outputRange: [1.08, 1],
              }),
            },
          ],
        }}
      >
        <View style={{ alignItems: "center", justifyContent: "center" }}>
          {/* <Bloom size={bloom} /> */}
          <Logo width={logoW} />
        </View>
      </Animated.View>

      <GlassDrawer
        width={width}
        delay={DRAWER_DELAY}
        // The two glass dials. `clear` keeps the mark's foot legible through
        // the blur; the tint is what buys the headline its contrast back —
        // raise it toward 0.8 for a heavier slab, drop it to 0 for bare glass.
        effect="clear"
        tintOpacity={0.95}
        style={{
          paddingTop: 45,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 56) + 10,
        }}
        prism={0.18}
      >
        {["ONE PLATFORM.", "EVERY STRATEGY.", "NO COMPROMISE."].map(
          (line, i) => (
            <Animated.View key={line} style={step(i)}>
              <Text
                style={{
                  fontFamily: F.displayBold,
                  fontSize: 36,
                  lineHeight: 45,
                  letterSpacing: 0.2,
                  color: i === 2 ? C.brand : C.text,
                  textAlign: "center",
                }}
              >
                {line}
              </Text>
            </Animated.View>
          ),
        )}

        <Animated.View style={[{ marginTop: 46 }, step(4)]}>
          <Text
            style={{
              fontFamily: F.body,
              fontSize: 15,
              textAlign: "center",
              color: C.silver,
            }}
          >
            Begin Membership {"•"} $1k/mo
          </Text>
        </Animated.View>

        <Animated.View style={[{ marginTop: 10 }, step(5)]}>
          <PressableScale
            scale={0.985}
            onPress={() => onLogin && onLogin("access")}
          >
            <View
              accessibilityRole="button"
              accessibilityLabel="Get Access"
              style={{
                height: 60,
                borderRadius: 999,
                backgroundColor: C.brand,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                shadowColor: C.brand,
                shadowOpacity: 0.3,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
                elevation: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: F.display,
                  fontSize: 21,
                  color: C.brandSoftInk,
                }}
              >
                Get Access
              </Text>
              <AccessGlyph />
            </View>
          </PressableScale>
        </Animated.View>
      </GlassDrawer>
    </View>
  );
}
