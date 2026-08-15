import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CandleChart, QuotePanel } from "@/components/trade";
import {
  Chip,
  GhostButton,
  KeyValueList,
  PrimaryButton,
  Screen,
} from "@/components/ui";
import { chartRanges, type TradeDetail } from "@/data/trades";
import { C, F } from "@/theme/tokens";

/** Clears the floating action bar so the last card is never trapped under it. */
const BAR_SPACE = 108;

export interface TradeDetailScreenProps {
  detail: TradeDetail;
  ranges?: readonly string[];
  /** Index into `ranges`. Uncontrolled unless `onRangeChange` is passed. */
  range?: number;
  onRangeChange?: (index: number) => void;
  onDismiss?: () => void;
  onCopy?: (id: string) => void;
}

/**
 * One leader position, opened: the live quote, the price action behind it, and
 * the numbers that decide whether to mirror it — with the two ways out pinned
 * to the bottom of the viewport rather than the bottom of the scroll.
 */
export default function TradeDetailScreen({
  detail,
  ranges = chartRanges,
  range,
  onRangeChange,
  onDismiss,
  onCopy,
}: TradeDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [internalRange, setInternalRange] = useState(3);
  const controlled = range !== undefined;
  const active = controlled ? range : internalRange;

  const { position } = detail;
  const down = position.side === "short";

  const selectRange = (i: number) => {
    if (!controlled) setInternalRange(i);
    onRangeChange?.(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <Screen pad={14} bottom={BAR_SPACE + insets.bottom}>
        <QuotePanel
          pair={position.pair}
          price={detail.currentPrice}
          label="BTC price"
          delta={position.changePct.replace("+", "")}
          live
          style={{ marginTop: 4 }}
        />

        <View style={{ flexDirection: "row", gap: 6, marginTop: 18 }}>
          {ranges.map((r, i) => (
            <Chip
              key={r}
              label={r}
              compact
              tone="highlight"
              active={i === active}
              onPress={() => selectRange(i)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <View style={{ marginTop: 22 }}>
          <CandleChart candles={detail.candles} times={detail.times} />
        </View>

        <KeyValueList
          style={{ marginTop: 24 }}
          rows={[
            { label: "Entry price", value: detail.entryPrice },
            { label: "Current price", value: detail.currentPrice },
            {
              label: "Unrealised P&L",
              value: detail.pnl,
              valueColor: down ? C.down : C.up,
            },
            { label: "Time open", value: detail.timeOpen },
          ]}
        />

        <Text
          style={{
            fontFamily: F.body,
            fontSize: 11.5,
            lineHeight: 17,
            textAlign: "center",
            color: C.dim,
            marginTop: 16,
          }}
        >
          Copying mirrors {position.trader}&apos;s entries and exits on this
          market. You can stop at any time; open positions stay yours.
        </Text>
      </Screen>

      {/* Pinned to the viewport: the decision has to stay reachable however far
          down the chart the user has scrolled. */}
      <View
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Math.max(insets.bottom, 12),
          flexDirection: "row",
          gap: 12,
        }}
      >
        <GhostButton
          label="Dismiss"
          height={56}
          size={16}
          onPress={onDismiss}
          style={{ width: "34%", backgroundColor: C.canvas }}
        />
        <PrimaryButton
          label="Copy This Trade"
          uppercase={false}
          color={C.brand}
          onPress={() => onCopy?.(position.id)}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}
