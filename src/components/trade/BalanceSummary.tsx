import { type ImageSource } from "expo-image";
import { Text, View } from "react-native";

import { C } from "../../theme/tokens";
import { ArtSlot } from "../home/ArtSlot";
import { TrendUpIcon } from "../icons";
import { AmountText, Body, Mono, PulseDot } from "../ui";

export interface BalanceStats {
  /** Formatted, currency-tagged — no math happens in the UI. */
  total: string;
  currency: string;
  gain: string;
  gainPct: string;
  /** Window the gain is measured over: "this month", "24h"… */
  period: string;
  live?: boolean;
  /** Optional state line beside the live dot, e.g. "Market Open". */
  status?: string;
}

/** Where the gain sits relative to the number it belongs to. */
export type BalanceLayout = "gain-first" | "amount-first";

/**
 * Balance block for a money surface: the account label, the number at display
 * size, and the gain — ordered either way round, since a trading balance
 * leads with its move and a portfolio leads with its worth.
 */
export function BalanceSummary({
  stats,
  label = "Trading balance",
  layout = "gain-first",
  emphasizeCents = false,
  artwork,
}: {
  stats: BalanceStats;
  label?: string;
  layout?: BalanceLayout;
  /** Render the decimals smaller, so the whole units carry the glance. */
  emphasizeCents?: boolean;
  artwork?: ImageSource | number;
}) {
  const amountFirst = layout === "amount-first";

  const gainRow = (
    <View className="flex-row items-center gap-[10px]">
      <View className="flex-row items-center gap-[6px] px-[10px] py-[6px] rounded-[99px] bg-up-tint">
        <TrendUpIcon size={13} color={C.up} />
        <Mono className="text-[12.5px] text-up">{stats.gain}</Mono>
      </View>
      <Body className="text-[11.5px] text-sub">
        {`${stats.gainPct} ${stats.period}`}
      </Body>
    </View>
  );

  const statusRow =
    stats.live || stats.status ? (
      <View
        className="flex-row items-center gap-[7px]"
        style={{
          marginBottom: amountFirst ? 0 : 12,
        }}
      >
        {stats.live ? <PulseDot color={C.live} size={8} /> : null}
        {stats.status ? (
          <Body className="text-[11.5px] text-silver">{stats.status}</Body>
        ) : null}
      </View>
    ) : null;

  const labelRow = (
    <View className="flex-row items-center gap-[6px]">
      <Text className="font-mono text-[11px] tracking-[1.8px] text-dim">
        {label.toUpperCase()}
      </Text>
      <Text className="font-mono-semibold text-[11px] tracking-[1.8px] text-brand-soft">
        {`IN ${stats.currency}`.toUpperCase()}
      </Text>
    </View>
  );

  return (
    <View>
      {artwork !== undefined ? (
        <ArtSlot
          source={artwork}
          size={132}
          style={{ position: "absolute", right: -8, top: -78 }}
        />
      ) : null}

      {amountFirst ? (
        <>
          {labelRow}
          <Amount total={stats.total} emphasizeCents={emphasizeCents} />
          <View className="mt-[12px] gap-[10px]">
            {statusRow}
            {gainRow}
          </View>
        </>
      ) : (
        <>
          {statusRow}
          {gainRow}
          <View className="mt-[14px]">{labelRow}</View>
          <Amount total={stats.total} emphasizeCents={emphasizeCents} />
        </>
      )}
    </View>
  );
}

function Amount({
  total,
  emphasizeCents,
}: {
  total: string;
  emphasizeCents: boolean;
}) {
  return (
    <AmountText
      value={total}
      size={40}
      emphasizeCents={emphasizeCents}
      className="mt-[8px]"
    />
  );
}
