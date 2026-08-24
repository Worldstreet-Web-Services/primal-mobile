import { Text, View } from "react-native";

/**
 * What is being paid for, and what it costs. The fiat figure leads and the
 * token amount sits under it — the charge is denominated in one and settled in
 * the other, and conflating them is how people overpay.
 */
export function PlanCard({
  plan,
  name,
  amount,
  amountSub,
}: {
  /** Product line above the name, e.g. "PRIMAL PREMIUM". */
  plan: string;
  name: string;
  amount: string;
  amountSub?: string;
}) {
  return (
    <View className="flex-row items-center gap-[12px] p-[18px] rounded-[18px] bg-canvas-raised border border-rule">
      <View className="flex-1">
        <Text className="font-mono text-[10.5px] tracking-[1.5px] text-silver">
          {plan.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          className="font-display-bold text-[19px] text-text mt-[7px]"
        >
          {name}
        </Text>
      </View>

      <View className="items-end">
        <Text className="font-display-bold text-[24px] text-brand">
          {amount}
        </Text>
        {amountSub ? (
          <Text className="font-mono text-[11.5px] text-sub mt-[5px]">
            {amountSub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
