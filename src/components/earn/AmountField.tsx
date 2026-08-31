import { Text, TextInput, View } from "react-native";

import { useTokens } from "@/theme/tokens";
import { Body, Chip } from "../ui";

/** The quick-fill rungs under the field, as fractions of the balance. */
export const AMOUNT_STEPS = [0.25, 0.5, 0.75, 1] as const;

/**
 * Amount entry for a deposit: one big figure, a `Max` shortcut pinned to the
 * field it fills, and the quarter steps beneath it.
 *
 * The value is held as a plain string by the caller — the field never parses,
 * formats or clamps it, because the screen that owns the balance is the only
 * thing that knows what a valid amount is.
 */
export function AmountField({
  label = "Enter Amount",
  value,
  onChangeText,
  onMax,
  onStep,
  activeStep,
  currency = "$",
}: {
  label?: string;
  value: string;
  onChangeText: (next: string) => void;
  onMax?: () => void;
  /** Fires with one of `AMOUNT_STEPS` when a quick-fill pill is tapped. */
  onStep?: (fraction: number) => void;
  /** The step currently reflected by `value`, so the row can mark it. */
  activeStep?: number | null;
  currency?: string;
}) {
  const t = useTokens();

  return (
    <View>
      <Body className="text-[12.5px] text-sub">{label}</Body>

      <View className="mt-[10px] rounded-[18px] border border-rule bg-canvas-raised px-[18px] py-[20px]">
        {/* Pinned to the field rather than sitting in the step row: `Max` is
            the value the field takes, not a proportion of something else. */}
        {onMax ? (
          <Chip
            label="Max"
            active
            tone="brand"
            onPress={onMax}
            className="absolute right-[14px] top-[14px] px-[13px] py-[5px]"
          />
        ) : null}

        <View className="flex-row items-baseline pr-[64px]">
          {value ? (
            <Text className="font-display text-[34px] leading-[38px] text-text">
              {currency}
            </Text>
          ) : null}
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={`${currency}0.00`}
            placeholderTextColor={t.placeholder}
            keyboardType="decimal-pad"
            inputMode="decimal"
            returnKeyType="done"
            accessibilityLabel={label}
            className="flex-1 p-0 font-display text-[34px] leading-[38px] text-text"
          />
        </View>
      </View>

      <View className="mt-[12px] flex-row gap-[8px]">
        {AMOUNT_STEPS.map((step) => (
          <Chip
            key={step}
            label={`${step * 100}%`}
            active={activeStep === step}
            tone="brand"
            onPress={() => onStep?.(step)}
            className="flex-1 py-[10px]"
          />
        ))}
      </View>
    </View>
  );
}
