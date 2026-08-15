import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingBackdrop } from "@/components/FloatingBackdrop";
import { GlassDrawer } from "@/components/GlassDrawer";
import { AppleMark, GoogleMark, KingsChatMark } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { AuthButton } from "@/components/ui";
import { C, F } from "@/theme/tokens";

/** Beat the drawer starts on — the mark gets the screen to itself until here. */
const DRAWER_DELAY = 560;

/** How far the mark rides down before the drawer pushes it up into place. */
const LIFT = 64;

const METHODS = [
  { id: "kingschat", label: "Sign in with KingsChat" },
  { id: "google", label: "Sign in with Google" },
  { id: "apple", label: "Sign in with Apple" },
] as const;

/**
 * Sign-in, second beat of onboarding. Same construction as the welcome screen:
 * mark on the floating backdrop, then a glass drawer rises over its foot
 * carrying the whole pitch — headline, provider stack, and the legal line.
 */
export default function SignInScreen({
  onSignIn,
}: {
  onSignIn?: (method: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const logoW = Math.min(width * 0.82, 230);

  const mark = useRef(new Animated.Value(0)).current;
  // One driver for the whole stack; each row reads a different slice of it,
  // which is what makes them arrive staggered off a single animation.
  const copy = useRef(new Animated.Value(0)).current;
  // Rides the drawer: the mark starts centered and is lifted as it arrives.
  const lift = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(mark, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();

    Animated.timing(lift, {
      toValue: 0,
      duration: 760,
      delay: DRAWER_DELAY,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();

    Animated.timing(copy, {
      toValue: 1,
      duration: 1100,
      delay: DRAWER_DELAY + 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [mark, copy, lift]);

  /** Slice `copy` into a rise-and-fade for the nth row down the stack. */
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
      <FloatingBackdrop opacity={0.7} />

      <Animated.View
        style={{
          position: "absolute",
          top: insets.top + height * 0.14,
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
            {
              translateY: lift.interpolate({
                inputRange: [0, 1],
                outputRange: [0, LIFT],
              }),
            },
          ],
        }}
      >
        <Logo width={logoW} />
      </Animated.View>

      <GlassDrawer
        width={width}
        delay={DRAWER_DELAY}
        effect="clear"
        tintOpacity={0.55}
        style={{
          marginHorizontal: 8,
          paddingTop: 38,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 50) + 8,
        }}
        prism={0}
      >
        {/* Overhangs the drawer's top-left corner and is clipped by it, so the
            smear reads as light spilling in from off-screen rather than a shape
            parked behind the type. */}
        {/* <Prism width={320} intensity={0.5} style={{ left: -84, top: -46 }} /> */}

        <View style={{ marginBottom: 68 }}>
          {["LET'S GET", "YOU IN"].map((line, i) => (
            <Animated.View key={line} style={step(i)}>
              <Text
                style={{
                  fontFamily: F.displayBold,
                  fontSize: 33,
                  lineHeight: 46,
                  letterSpacing: 0.2,
                  color: i === 0 ? C.brand : C.text,
                  textAlign: "center",
                }}
              >
                {line}
              </Text>
            </Animated.View>
          ))}
        </View>

        {METHODS.map((m, i) => (
          <Animated.View
            key={m.id}
            style={[{ marginTop: i === 0 ? 0 : 16 }, step(i + 2)]}
          >
            <AuthButton
              label={m.label}
              tone={m.id === "kingschat" ? "brand" : "neutral"}
              icon={
                m.id === "kingschat" ? (
                  <KingsChatMark />
                ) : m.id === "google" ? (
                  <GoogleMark />
                ) : (
                  <AppleMark />
                )
              }
              onPress={() => onSignIn?.(m.id)}
            />
          </Animated.View>
        ))}
      </GlassDrawer>
    </View>
  );
}
