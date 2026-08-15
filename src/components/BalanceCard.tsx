import { useState } from "react";
import { Text, View, type ViewStyle } from "react-native";

import { C, F } from "../theme/tokens";
import { TrendUpIcon } from "./icons";
import { AmountText, Display, PressableScale, Shine } from "./ui";

/** What replaces the figure when it's hidden. */
const MASK = "••••••";

export interface BalanceDelta {
  /** Preformatted move, e.g. "+$3,204.18". */
  value: string;
  /** The frame it's measured over, e.g. "+6.9% this month". */
  caption?: string;
  /** Down moves flip the tint and the arrow. */
  negative?: boolean;
}

/**
 * The balance slab: what moved, what the figure is, and what it's denominated
 * in. Tapping it hides the figure — shoulder-surfing is the everyday threat on
 * a number this prominent.
 *
 * Visibility is uncontrolled by default; pass `hidden` with `onToggle` to hoist
 * it (e.g. to persist the preference app-wide). The delta hides with it, since
 * a visible move on a masked balance leaks most of the number back.
 */
export function BalanceCard({
  amount,
  label = "Trading balance",
  currency = "in USD",
  delta,
  hidden,
  onToggle,
  onPress,
  style,
}: {
  /** Preformatted — the UI never does the math. */
  amount: string;
  label?: string;
  /** Denomination, set beside the label in full contrast. */
  currency?: string;
  delta?: BalanceDelta;
  /** Controlled visibility. Leave unset to let the card own it. */
  hidden?: boolean;
  onToggle?: (hidden: boolean) => void;
  /** Fires alongside the toggle, for callers that want the tap too. */
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const [internalHidden, setInternalHidden] = useState(false);
  const controlled = hidden !== undefined;
  const isHidden = controlled ? hidden : internalHidden;

  const tone = delta?.negative ? C.down : C.up;

  const handlePress = () => {
    const next = !isHidden;
    if (!controlled) setInternalHidden(next);
    onToggle?.(next);
    onPress?.();
  };

  return (
    <PressableScale
      onPress={handlePress}
      scale={0.99}
      accessibilityLabel={isHidden ? "Show balance" : "Hide balance"}
      style={style}
    >
      <View
        style={{
          borderRadius: 22,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          overflow: "hidden",
          paddingHorizontal: 18,
          paddingTop: 20,
          paddingBottom: 34,
        }}
      >
        <Shine />

        {delta && !isHidden ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: delta.negative
                  ? "rgba(246,165,165,0.12)"
                  : C.upBg,
              }}
            >
              <TrendUpIcon size={13} color={tone} />
              <Text
                style={{ fontFamily: F.bodySemibold, fontSize: 13, color: tone }}
              >
                {delta.value}
              </Text>
            </View>
            {delta.caption ? (
              <Text
                style={{ fontFamily: F.body, fontSize: 12.5, color: C.sub }}
              >
                {delta.caption}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Label and denomination share one baseline — the denomination is the
            half that changes, so it carries the contrast. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
            marginTop: delta ? 16 : 0,
          }}
        >
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 1.8,
              color: C.dim,
            }}
          >
            {label.toUpperCase()}
          </Text>
          {currency ? (
            <Text
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 11,
                letterSpacing: 1.8,
                color: C.text,
              }}
            >
              {currency.toUpperCase()}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 6 }}>
          {isHidden ? (
            <Display size={40}>{MASK}</Display>
          ) : (
            <AmountText value={amount} size={40} />
          )}
        </View>
      </View>
    </PressableScale>
  );
}
