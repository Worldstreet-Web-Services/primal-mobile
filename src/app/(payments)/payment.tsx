import FundingOptions from "@/components/shared/funding-options";
import { DRAWER_COPY_DELAY } from "@/lib/motion";
import { C, F } from "@/theme/tokens";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

const PaymentScreen = () => {
  const copy = useRef(new Animated.Value(0)).current;

  // Without this the value never leaves 0 and every row below interpolates to
  // opacity 0 — the route renders, but nothing in it is visible.
  useEffect(() => {
    const run = Animated.timing(copy, {
      toValue: 1,
      duration: 900,
      delay: DRAWER_COPY_DELAY,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [copy]);

  /** Slice `copy` into a rise-and-fade for the nth row down the stack. */
  const step = (i: number) => {
    const start = i * 0.11;
    const range = [start, Math.min(start + 0.42, 1)];
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
            outputRange: [22, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  return (
    <View>
      <View style={{ marginBottom: 78, marginTop: 10 }}>
        {["CHOOSE PAYMENT", "METHOD"].map((line, i) => (
          <Animated.View key={line} style={step(i)}>
            <Text
              style={{
                fontFamily: F.displayBold,
                fontSize: 33,
                lineHeight: 46,
                letterSpacing: 0.2,
                color: C.text,
                textAlign: "center",
              }}
            >
              {line}
            </Text>
          </Animated.View>
        ))}
      </View>

      {/* Funding options — carries on the same stagger as the heading above,
          so the section reads as one cascade rather than a second animation. */}
      {/* Confirming leaves checkout behind for good, so the payment screen is
          replaced rather than stacked — a back swipe from the welcome beat
          must not land the user back in a checkout they already completed. */}
      <FundingOptions onConfirm={() => router.replace("/continue")} />
    </View>
  );
};

export default PaymentScreen;
