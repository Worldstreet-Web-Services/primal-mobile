import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { BackChevron, CircleAction, Label, PrimaryButton } from "../ui";
import { NoticeBanner } from "./NoticeBanner";
import { PlanCard } from "./PlanCard";
import { SelectPill } from "./SelectPill";

export interface BankQuote {
  plan: string;
  name: string;
  amount: string;
  amountSub?: string;
  method: { label: string; color?: string };
  bank: { label: string; color?: string };
}

// There is deliberately NO default quote — the same rule `CryptoCheckout` now
// holds to, for the same reason.
//
// There used to be one, and it was invented end to end: a "$1,000 / ₦1,540,000"
// price nobody quoted, at "Rubies MFB", a bank the member has no account with.
// Because `quote` was optional, `<LocalBankCheckout />` with no props rendered
// all of it under a live "Confirm payment" button — a checkout for a figure the
// backend never stated.
//
// `quote` is required now. A bank checkout with nothing to quote must not be
// renderable at all, and the type system is the only thing that reliably
// enforces that.

/**
 * Pay over local rails — card or bank wire. Mirrors `CryptoCheckout`'s shape so
 * the two read as one flow with different plumbing underneath.
 */
export function LocalBankCheckout({
  quote,
  onBack,
  onClose,
  onConfirm,
  onChangeBank,
}: {
  /** Required: see the note above — there is no safe default for a price. */
  quote: BankQuote;
  onBack?: () => void;
  onClose?: () => void;
  onConfirm?: () => void;
  onChangeBank?: () => void;
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
          Bank Checkout
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
          Select method & bank
        </Label>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <SelectPill
            label={quote.method.label}
            badgeColor={quote.method.color}
            selected
            style={{ flex: 1 }}
          />
          <SelectPill
            label={quote.bank.label}
            badgeColor={quote.bank.color}
            chevron
            onPress={onChangeBank}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>

      <Animated.View style={[{ marginTop: 20 }, step(3)]}>
        <NoticeBanner
          tone="info"
          message="Transfers settle in seconds during banking hours. Rates are quoted by the provider and fixed at confirmation."
        />
      </Animated.View>

      <Animated.View style={[{ marginTop: 26 }, step(4)]}>
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
