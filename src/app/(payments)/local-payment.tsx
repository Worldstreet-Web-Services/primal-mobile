import { DRAWER_COPY_DELAY } from "@/lib/motion";
import { C, F } from "@/theme/tokens";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

const LocalPaymentScreen = () => {
  const copy = useRef(new Animated.Value(0)).current;

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

  return (
    <Animated.View
      style={{
        opacity: copy,
        transform: [
          {
            translateY: copy.interpolate({
              inputRange: [0, 1],
              outputRange: [22, 0],
            }),
          },
        ],
      }}
    >
      <View style={{ marginBottom: 28 }}>
        <Text
          style={{
            fontFamily: F.displayBold,
            fontSize: 33,
            lineHeight: 46,
            letterSpacing: 0.2,
            color: C.text,
          }}
        >
          LOCAL BANK
        </Text>
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 1.8,
            color: C.dim,
            marginTop: 8,
          }}
        >
          CARD OR BANK WIRE
        </Text>
      </View>
    </Animated.View>
  );
};

export default LocalPaymentScreen;
