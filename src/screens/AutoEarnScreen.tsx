import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, View } from "react-native";

import { AmountField, RateCard, YieldEstimate } from "@/components/earn";
import { ShieldCheckIcon } from "@/components/icons";
import { NoticeBanner } from "@/components/payments";
import { Body, MetallicButton, Screen } from "@/components/ui";
import { autoEarn } from "@/data/earn";
import { useTokens } from "@/theme/tokens";

export interface AutoEarnScreenProps {
  /** Spendable balance the deposit is drawn from — what `Max` and 100% mean. */
  available?: number;
  /** Quoted variable rate, as a percentage per year. */
  apy?: number;
  /** Signed movement in that rate over the quoting period. */
  apyDelta?: string;
  /** Head space for a floating nav header; 0 when the header sits in flow. */
  top?: number;
  /** Tail space under the sticky action — the safe-area inset. */
  bottom?: number;
  /** Fires with the entered amount, in whole currency units. */
  onProceed?: (amount: number) => void;
  onCancel?: () => void;
}

/** Height of the sticky footer, so the scroll can end clear of it. */
const FOOTER = 128;

const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * `"1,250.5"` → `1250.5`, and `NaN` for anything that isn't a figure.
 *
 * The field hands back whatever the keyboard produced, separators included, so
 * every read of it goes through here rather than through a bare `Number()`.
 */
const parse = (text: string) => Number(text.replace(/,/g, ""));

/**
 * Auto Earn (PRD §F7): move idle balance into the yield product.
 *
 * The order is the argument the screen makes — how much, at what rate, for what
 * return, and only then the way out. The estimate is derived from the entered
 * amount rather than quoted, so an empty field honestly shows nothing earned;
 * the rate above it is the only number here the app does not compute.
 */
export default function AutoEarnScreen({
  available = autoEarn.available,
  apy = autoEarn.apy,
  apyDelta = autoEarn.apyDelta,
  top = 0,
  bottom = 0,
  onProceed,
  onCancel,
}: AutoEarnScreenProps) {
  const t = useTokens();
  const [amount, setAmount] = useState("");

  const entered = parse(amount);
  const valid = Number.isFinite(entered) && entered > 0 && entered <= available;

  // A step is "active" only while the field still holds exactly what it filled
  // in — typing over it drops the marker rather than leaving a stale one lit.
  const activeStep = useMemo(() => {
    if (!Number.isFinite(entered) || entered <= 0 || available <= 0)
      return null;
    const fraction = entered / available;
    const match = [0.25, 0.5, 0.75, 1].find(
      (step) => Math.abs(step - fraction) < 0.0001,
    );
    return match ?? null;
  }, [entered, available]);

  const principal = Number.isFinite(entered) && entered > 0 ? entered : 0;
  const annual = (principal * apy) / 100;

  const rows = [
    { label: "Daily Yield", value: `+$${money(annual / 365)}`, accent: true },
    { label: "Monthly Yield", value: `+$${money(annual / 12)}` },
    { label: "Annual Yield", value: `+$${money(annual)}` },
  ];

  const fill = (fraction: number) => setAmount(money(available * fraction));

  return (
    <View className="flex-1 bg-canvas">
      <Screen
        pad={16}
        top={top}
        // The keyboard is open over this form, so the first tap has to reach
        // the button under it rather than being spent dismissing the keyboard.
        keyboardShouldPersistTaps="handled"
        bottom={bottom + FOOTER}
      >
        <AmountField
          value={amount}
          onChangeText={setAmount}
          onMax={() => fill(1)}
          onStep={fill}
          activeStep={activeStep}
        />

        <View className="mt-[16px]">
          <RateCard rate={`${apy}%`} delta={apyDelta} />
        </View>

        <View className="mt-[14px]">
          <YieldEstimate rows={rows} />
        </View>

        {/* Last thing before the CTA, on purpose: the reassurance answers the
            question the CTA is about to ask. */}
        <View className="mt-[14px]">
          <NoticeBanner
            tone="positive"
            icon={<ShieldCheckIcon size={17} color={t.brandSoft} />}
            message="You remain in full control. Liquidate and withdraw back to your main wallet instantly."
          />
        </View>
      </Screen>

      {/* Sticky rather than in flow: the decision belongs to the screen, not to
          the last card on it.

          It rides up with the keyboard because the field above it opens a
          decimal pad, which on iOS has no return key — a CTA parked underneath
          that would be unreachable until the user guessed to tap the page. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
        className="absolute bottom-[0px] left-[0px] right-[0px]"
      >
        <View className="px-[16px]" style={{ paddingBottom: bottom + 8 }}>
          <MetallicButton
            label="Proceed"
            size={16}
            height={56}
            disabled={!valid}
            onPress={() => onProceed?.(entered)}
          />
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={8}
            className="items-center py-[14px]"
          >
            <Body className="text-[14.5px] text-sub">Cancel</Body>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
