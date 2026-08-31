import { Text, View } from "react-native";

import { TrendUpIcon } from "../icons";
import { Label } from "../ui";

/**
 * The headline rate, centred on its own card: what the money earns, and which
 * way that number has been moving.
 *
 * The figure takes the money-in green rather than the brand colour — it is a
 * return, and on this screen the brand is the CTA sitting underneath it.
 */
export function RateCard({
  label = "Current variable rate",
  rate,
  unit = "APY",
  delta,
}: {
  label?: string;
  /** Preformatted — the screen quotes the rate, it never computes it. */
  rate: string;
  unit?: string;
  /** Signed movement over the quoting period, e.g. `+0.85% this week`. */
  delta?: string;
}) {
  return (
    <View className="items-center rounded-[18px] border border-rule bg-canvas-raised px-[18px] py-[18px]">
      <Label>{label}</Label>

      <View className="mt-[6px] flex-row items-baseline gap-[8px]">
        <Text className="font-display-bold text-[38px] leading-[42px] text-up">
          {rate}
        </Text>
        <Text className="font-body-semibold text-[15px] text-text">{unit}</Text>
      </View>

      {delta ? (
        <View className="mt-[10px] flex-row items-center gap-[6px] rounded-full bg-up-tint px-[12px] py-[6px]">
          <TrendUpIcon size={12} />
          <Text className="font-body-semibold text-[11.5px] text-up">
            {delta}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
