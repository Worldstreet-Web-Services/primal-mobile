import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { BalanceCard } from "@/components/BalanceCard";
import { PlusIcon } from "@/components/icons";
import { TradeList, type Position } from "@/components/trade";
import { Chip, PrimaryButton, Screen } from "@/components/ui";
import {
  openPositions as defaultPositions,
  tradingBalance as defaultBalance,
  tradeFilters,
  type TradeFilter,
} from "@/data/trades";
import type { BalanceStats } from "@/components/trade";
import { C, F } from "@/theme/tokens";

export interface CopyTradingScreenProps {
  balance?: BalanceStats;
  positions?: Position[];
  /** Head space for a floating nav header, when one is mounted above. */
  top?: number;
  onFund?: () => void;
  onCopy?: (id: string) => void;
}

/**
 * Copy trading (PRD §F6): what the account is worth, how to add to it, then
 * the leader positions available to mirror. Filtering is local — the feed
 * itself arrives whole.
 */
export default function CopyTradingScreen({
  balance = defaultBalance,
  positions = defaultPositions,
  top = 0,
  onFund,
  onCopy,
}: CopyTradingScreenProps) {
  const [filter, setFilter] = useState<TradeFilter>("All");

  const visible = useMemo(
    () =>
      filter === "All"
        ? positions
        : positions.filter((p) => p.side === filter.toLowerCase()),
    [filter, positions],
  );

  return (
    <Screen pad={14} top={top} bottom={130}>
      <BalanceCard
        amount={balance.total}
        currency={`in ${balance.currency}`}
        delta={{
          value: balance.gain,
          caption: `${balance.gainPct} ${balance.period}`,
        }}
      />

      <PrimaryButton
        label="Fund account"
        color={C.brand}
        onPress={onFund}
        icon={<PlusIcon size={18} color={C.brandSoftInk} />}
        style={{ marginTop: 20 }}
      />

      <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
        {tradeFilters.map((f) => (
          <Chip
            key={f}
            label={f.toUpperCase()}
            tone="brand"
            active={f === filter}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {/* Counts what's on screen, not what arrived — the filter is the whole
          point of the row above it. */}
      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1.5,
          color: C.dim,
          textAlign: "center",
          marginTop: 16,
        }}
      >
        {`${visible.length} TRADE${visible.length === 1 ? "" : "S"} · LIVE`}
      </Text>

      <View style={{ marginTop: 14 }}>
        <TradeList positions={visible} onCopy={onCopy} />
      </View>
    </Screen>
  );
}
