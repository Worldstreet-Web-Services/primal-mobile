import { Text, View, type ViewStyle } from "react-native";

import { C, withAlpha } from "../../theme/tokens";
import { TrendDownIcon, TrendUpIcon } from "../icons";
import { AmountText, PulseDot } from "../ui";

/**
 * The market header on a trade surface: what's being quoted, how it's moving,
 * and the price at display size. The live dot only appears when the feed is
 * actually streaming — a static dot on a stale price is worse than none.
 */
export function QuotePanel({
  pair,
  price,
  label,
  delta,
  down = false,
  live = false,
  style,
}: {
  /** Market symbol as it should read, e.g. "Btc/Usdt". */
  pair: string;
  /** Preformatted — the UI never does the math. */
  price: string;
  /** What the number is, e.g. "BTC price". */
  label?: string;
  /** Preformatted move, e.g. "12.5%". */
  delta?: string;
  down?: boolean;
  live?: boolean;
  style?: ViewStyle;
}) {
  const tone = down ? C.down : C.up;

  return (
    <View
      className="bg-canvas-raised rounded-[18px] border border-rule px-[18px] pt-[16px] pb-[22px]"
      style={style}
    >
      {live ? (
        <View className="mb-[12px]">
          <PulseDot color={C.live} size={8} />
        </View>
      ) : null}

      <View className="flex-row items-center gap-[10px]">
        <Text className="font-display text-[17px] tracking-[0.2px] text-sub">
          {pair}
        </Text>
        {delta ? (
          <View
            className="flex-row items-center gap-[4px] px-[8px] py-[4px] rounded-[8px]"
            style={{
              backgroundColor: down ? withAlpha(C.down, 0.12) : C.upBg,
            }}
          >
            {down ? (
              <TrendDownIcon size={12} color={tone} />
            ) : (
              <TrendUpIcon size={12} color={tone} />
            )}
            <Text
              className="font-body-semibold text-[12.5px]"
              style={{
                color: tone,
              }}
            >
              {delta}
            </Text>
          </View>
        ) : null}
      </View>

      {label ? (
        <Text className="font-mono text-[11px] tracking-[1.8px] text-dim mt-[8px]">
          {label.toUpperCase()}
        </Text>
      ) : null}

      <View className="mt-[6px]">
        <AmountText value={price} size={40} />
      </View>
    </View>
  );
}
