import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { BackChevron, CircleAction, Label, PrimaryButton } from "../ui";
import { AddressField } from "./AddressField";
import { NoticeBanner } from "./NoticeBanner";
import { PlanCard } from "./PlanCard";
import { SelectPill } from "./SelectPill";

export interface CryptoQuote {
  plan: string;
  name: string;
  amount: string;
  amountSub?: string;
  asset: { label: string; color?: string };
  network: { label: string; color?: string };
  address: string;
}

// Checkout is quoted, not computed here: the fiat charge and its token
// equivalent both arrive preformatted from the quote.
const DEFAULT_QUOTE: CryptoQuote = {
  plan: "Primal Premium",
  name: "Montly Subscription",
  amount: "$1,000",
  amountSub: "1,000 USDC",
  asset: { label: "USDC", color: "#2775CA" },
  network: { label: "Polygon", color: "#8247E5" },
  address: "0x71C249E91D31111a474EdF65F0aE9Ec3f1B2c7Ad",
};

/**
 * Pay from a self-custody wallet: what's owed, which asset and chain it settles
 * on, and the address to send it to.
 *
 * Presentational — `onBack` and `onClose` are whatever the host wants them to
 * be, so it works as a sheet's contents or as a screen.
 */
export function CryptoCheckout({
  quote = DEFAULT_QUOTE,
  onBack,
  onClose,
  onConfirm,
  onChangeNetwork,
}: {
  quote?: CryptoQuote;
  onBack?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
  onChangeNetwork?: () => void;
}) {
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.timing(copy, {
      toValue: 1,
      duration: 760,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [copy]);

  /** Slice `copy` into a rise-and-fade for the nth block down the sheet. */
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
          { flexDirection: "row", alignItems: "center", marginBottom: 22 },
          step(0),
        ]}
      >
        <CircleAction onPress={onBack} accessibilityLabel="Go back">
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
      </Animated.View>

      <Animated.View style={step(1)}>
        <PlanCard
          plan={quote.plan}
          name={quote.name}
          amount={quote.amount}
          amountSub={quote.amountSub}
        />
      </Animated.View>

      <Animated.View style={[{ marginTop: 24 }, step(2)]}>
        <Label style={{ color: C.silver, fontSize: 11 }}>
          Select asset & network
        </Label>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <SelectPill
            label={quote.asset.label}
            badgeColor={quote.asset.color}
            selected
            style={{ flex: 1 }}
          />
          <SelectPill
            label={quote.network.label}
            badgeColor={quote.network.color}
            chevron
            onPress={onChangeNetwork}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>

      <Animated.View style={[{ marginTop: 24 }, step(3)]}>
        <Label style={{ fontSize: 11 }}>Deposit address</Label>
        <View style={{ marginTop: 12 }}>
          <AddressField address={quote.address} />
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
          onPress={onConfirm}
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
}
