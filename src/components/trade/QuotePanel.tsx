import { Text, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
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
      style={[
        {
          backgroundColor: C.raised,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: C.hairline,
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 22,
        },
        style,
      ]}
    >
      {live ? (
        <View style={{ marginBottom: 12 }}>
          <PulseDot color={C.live} size={8} />
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          style={{
            fontFamily: F.display,
            fontSize: 17,
            letterSpacing: 0.2,
            color: C.sub,
          }}
        >
          {pair}
        </Text>
        {delta ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: down ? "rgba(246,165,165,0.12)" : C.upBg,
            }}
          >
            {down ? (
              <TrendDownIcon size={12} color={tone} />
            ) : (
              <TrendUpIcon size={12} color={tone} />
            )}
            <Text
              style={{ fontFamily: F.bodySemibold, fontSize: 12.5, color: tone }}
            >
              {delta}
            </Text>
          </View>
        ) : null}
      </View>

      {label ? (
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 1.8,
            color: C.dim,
            marginTop: 8,
          }}
        >
          {label.toUpperCase()}
        </Text>
      ) : null}

      <View style={{ marginTop: 6 }}>
        <AmountText value={price} size={40} />
      </View>
    </View>
  );
}
