import { CloseIcon } from "@/components/icons";
import {
  AddressField,
  NoticeBanner,
  PlanCard,
  SelectPill,
} from "@/components/payments";
import {
  BackChevron,
  CircleAction,
  Label,
  PrimaryButton,
} from "@/components/ui";
import { C, F } from "@/theme/tokens";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

// Checkout is quoted, not computed here: the fiat charge and its token
// equivalent both arrive preformatted from the quote.
const CHECKOUT = {
  plan: "Primal Premium",
  name: "Montly Subscription",
  amount: "$1,000",
  amountSub: "1,000 USDC",
  asset: { label: "USDC", color: "#2775CA" },
  network: { label: "Polygon", color: "#8247E5" },
  address: "0x71C249E91D31111a474EdF65F0aE9Ec3f1B2c7Ad",
};

const CryptoPaymentScreen = () => {
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.timing(copy, {
      toValue: 1,
      duration: 900,
      delay: 0,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [copy]);

  /** Slice `copy` into a rise-and-fade for the nth block down the screen. */
  const step = (i: number) => {
    const start = Math.min(i * 0.09, 0.55);
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
            outputRange: [18, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  return (
    <View>
      {/* Header: back and close flank a centered title. */}
      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 22,
          },
          step(0),
        ]}
      >
        <CircleAction
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <BackChevron color={C.text} />
        </CircleAction>

        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: F.displayBold,
            fontSize: 17,
            color: C.text,
          }}
        >
          Crypto Checkout
        </Text>

        <CircleAction
          onPress={() => router.dismissTo("/payment")}
          accessibilityLabel="Close checkout"
        >
          <CloseIcon size={17} color={C.text} />
        </CircleAction>
      </Animated.View>

      <Animated.View style={step(1)}>
        <PlanCard
          plan={CHECKOUT.plan}
          name={CHECKOUT.name}
          amount={CHECKOUT.amount}
          amountSub={CHECKOUT.amountSub}
        />
      </Animated.View>

      <Animated.View style={[{ marginTop: 24 }, step(2)]}>
        <Label style={{ color: C.silver, fontSize: 11 }}>
          Select asset & network
        </Label>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <SelectPill
            label={CHECKOUT.asset.label}
            badgeColor={CHECKOUT.asset.color}
            selected
            style={{ flex: 1 }}
          />
          <SelectPill
            label={CHECKOUT.network.label}
            badgeColor={CHECKOUT.network.color}
            chevron
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>

      <Animated.View style={[{ marginTop: 24 }, step(3)]}>
        <Label style={{ fontSize: 11 }}>Deposit address</Label>
        <View style={{ marginTop: 12 }}>
          <AddressField address={CHECKOUT.address} />
        </View>
      </Animated.View>

      <Animated.View style={[{ marginTop: 20 }, step(4)]}>
        <NoticeBanner message="Confirm that the wallet address and network above match your sending wallet before continuing." />
      </Animated.View>

      <Animated.View style={[{ marginTop: 26 }, step(5)]}>
        <PrimaryButton
          label="Confirm payment"
          height={58}
          uppercase={false}
          onPress={() => router.push("/continue")}
        />
        <Text
          style={{
            fontFamily: F.body,
            fontSize: 12,
            lineHeight: 18,
            textAlign: "center",
            color: C.sub,
            marginTop: 16,
          }}
        >
          Your subscription unlocks instantly upon transaction confirmation
        </Text>
      </Animated.View>
    </View>
  );
};

export default CryptoPaymentScreen;
