import { FloatingBackdrop } from "@/components/FloatingBackdrop";
import { GlassDrawer } from "@/components/GlassDrawer";
import { Logo } from "@/components/Logo";
import { DRAWER_DELAY } from "@/lib/motion";
import { C } from "@/theme/tokens";
import { Slot } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** How far the mark rides down before the drawer pushes it up into place. */
const LIFT = 64;

// Shared chrome for /payment and /crypto-payment: the mark, the backdrop, and
// the drawer. `Slot` is where the matched child route renders.
const PaymentLayout = () => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const logoW = Math.min(width * 0.82, 230);

  const mark = useRef(new Animated.Value(0)).current;
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
  }, [mark, lift]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <FloatingBackdrop opacity={0.25} />

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
        tintOpacity={0.95}
        style={{
          marginHorizontal: 8,
          paddingTop: 28,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
        }}
        prism={0}
      >
        <View>
          <Slot />
        </View>
      </GlassDrawer>
    </View>
  );
};

export default PaymentLayout;
