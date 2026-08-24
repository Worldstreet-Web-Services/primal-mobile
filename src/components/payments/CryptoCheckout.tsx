import { useEffect, useMemo } from "react";
import { Animated, Text, View } from "react-native";

import { C } from "../../theme/tokens";
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

// There is deliberately NO default quote.
//
// There used to be one, carrying a hardcoded deposit address, and `quote` was
// optional — so `<CryptoCheckout />` with no props rendered a real-looking
// address with a working Copy button. It was mounted exactly that way by the
// funding sheet on two routes reachable from the home screen, which made a
// fabricated destination for someone's money three taps from launch.
//
// `quote` is required now. A checkout with nothing to quote must not be
// renderable at all, and the type system is the only thing that reliably
// enforces that.

/**
 * Pay from a self-custody wallet: what's owed, which asset and chain it settles
 * on, and the address to send it to.
 *
 * Presentational — `onBack` and `onClose` are whatever the host wants them to
 * be, so it works as a sheet's contents or as a screen.
 */
export function CryptoCheckout({
  quote,
  onBack,
  onClose,
  onConfirm,
  onChangeNetwork,
}: {
  /** Required: see the note above — there is no safe default for a destination. */
  quote: CryptoQuote;
  onBack?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
  onChangeNetwork?: () => void;
}) {
  const copy = useMemo(() => new Animated.Value(0), []);

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
        className="flex-row items-center mb-[22px]"
        style={step(0)}
      >
        <CircleAction onPress={onBack} accessibilityLabel="Go back">
          <BackChevron color={C.text} />
        </CircleAction>

        <Text className="flex-1 text-center font-display-bold text-[17px] text-text">
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

      <Animated.View className="mt-[24px]" style={step(2)}>
        <Label className="text-silver text-[11px]">
          Select asset & network
        </Label>
        <View className="flex-row gap-[12px] mt-[12px]">
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

      <Animated.View className="mt-[24px]" style={step(3)}>
        <Label className="text-[11px]">Deposit address</Label>
        <View className="mt-[12px]">
          <AddressField address={quote.address} />
        </View>
      </Animated.View>

      <Animated.View className="mt-[20px]" style={step(4)}>
        <NoticeBanner message="Confirm that the wallet address and network above match your sending wallet before continuing." />
      </Animated.View>

      <Animated.View className="mt-[26px]" style={step(5)}>
        <PrimaryButton
          label="Confirm payment"
          height={58}
          uppercase={false}
          onPress={onConfirm}
        />
        <Text className="font-body text-[12px] leading-[18px] text-center text-sub mt-[16px]">
          Your subscription unlocks instantly upon transaction confirmation
        </Text>
      </Animated.View>
    </View>
  );
}
