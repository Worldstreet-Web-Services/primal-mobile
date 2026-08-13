import { type ImageSource } from "expo-image";
import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { ArtSlot } from "../home/ArtSlot";
import { TrendUpIcon } from "../icons";
import { Body, Display, Mono, PulseDot } from "../ui";

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
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 99,
          backgroundColor: C.upBg,
        }}
      >
        <TrendUpIcon size={13} color={C.up} />
        <Mono size={12.5} color={C.up}>
          {stats.gain}
        </Mono>
      </View>
      <Body size={11.5} color={C.sub}>
        {`${stats.gainPct} ${stats.period}`}
      </Body>
    </View>
  );

  const statusRow =
    stats.live || stats.status ? (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          marginBottom: amountFirst ? 0 : 12,
        }}
      >
        {stats.live ? <PulseDot color={C.leaf} size={8} /> : null}
        {stats.status ? (
          <Body size={11.5} color={C.silver}>
            {stats.status}
          </Body>
        ) : null}
      </View>
    ) : null;

  const labelRow = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 11,
          letterSpacing: 1.8,
          color: C.leaf,
        }}
      >
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
          <View style={{ marginTop: 12, gap: 10 }}>
            {statusRow}
            {gainRow}
          </View>
        </>
      ) : (
        <>
          {statusRow}
          {gainRow}
          <View style={{ marginTop: 14 }}>{labelRow}</View>
          <Amount total={stats.total} emphasizeCents={emphasizeCents} />
        </>
      )}
    </View>
  );
}

/** Splits on the decimal separator so the cents can ride smaller. */
function Amount({
  total,
  emphasizeCents,
}: {
  total: string;
  emphasizeCents: boolean;
}) {
  const size = 40;
  const dot = emphasizeCents ? total.lastIndexOf(".") : -1;

  if (dot === -1) {
    return (
      <Display size={size} style={{ marginTop: 8 }}>
        {total}
      </Display>
    );
  }

  return (
    <Display size={size} style={{ marginTop: 8 }}>
      {total.slice(0, dot)}
      <Text style={{ fontFamily: F.display, fontSize: size * 0.55 }}>
        {total.slice(dot)}
      </Text>
    </Display>
  );
}
