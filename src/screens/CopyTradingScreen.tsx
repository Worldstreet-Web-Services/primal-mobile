import { type ImageSource } from "expo-image";
import { useMemo, useState } from "react";
import { View } from "react-native";

import {
  BalanceSummary,
  TradeList,
  type BalanceStats,
  type Position,
} from "@/components/trade";
import { Chip, OutlineButton } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import {
  openPositions as defaultPositions,
  tradingBalance as defaultBalance,
  tradeFilters,
  type TradeFilter,
} from "@/data/trades";
import { C } from "@/theme/tokens";
import { Screen } from "@/components/ui";

export interface CopyTradingScreenProps {
  balance?: BalanceStats;
  positions?: Position[];
  artwork?: ImageSource | number;
  /** Head space for the floating nav header. */
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
  artwork,
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
    <Screen pad={16} top={top} bottom={130}>
      <View style={{ marginTop: 18 }}>
        <BalanceSummary stats={balance} artwork={artwork} />
      </View>

      <View style={{ marginTop: 22 }}>
        <OutlineButton
          label="Fund wallet"
          onPress={onFund}
          icon={
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                backgroundColor: C.brandSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlusIcon size={13} color={C.brandSoftInk} />
            </View>
          }
        />
      </View>

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

      <View style={{ marginTop: 20 }}>
        <TradeList positions={visible} onCopy={onCopy} />
      </View>
    </Screen>
  );
}
