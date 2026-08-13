import { View } from "react-native";

import { C } from "../../theme/tokens";
import { Body, Mono, SegTabs } from "../ui";
import { AreaChart } from "./AreaChart";

export interface Quote {
  symbol: string;
  price: string;
  delta: string;
  /** Down moves flip the whole card's accent. */
  down?: boolean;
}

/**
 * Quote header, price history, range picker. The series is whatever the caller
 * hands over — switching range is their job, since the data comes with it.
 */
export function ChartCard({
  quote,
  data,
  ranges,
  activeRange = 0,
  onRangeChange,
  height = 130,
}: {
  quote: Quote;
  data: number[];
  ranges: string[];
  activeRange?: number;
  onRangeChange?: (index: number) => void;
  height?: number;
}) {
  const color = quote.down ? C.down : C.up;

  return (
    <View
      style={{
        backgroundColor: C.raised,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.hairline,
        paddingTop: 14,
        paddingBottom: 10,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          gap: 8,
          paddingHorizontal: 14,
        }}
      >
        <Body size={13} semibold>
          {quote.symbol}
        </Body>
        <Mono size={11.5} color={C.silver}>
          {quote.price}
        </Mono>
        <Mono size={11} color={color}>
          {quote.delta}
        </Mono>
      </View>

      <View style={{ marginTop: 10 }}>
        <AreaChart data={data} height={height} color={color} />
      </View>

      <View style={{ paddingHorizontal: 10, marginTop: 10 }}>
        <SegTabs
          tone="ghost"
          tabs={ranges}
          active={activeRange}
          onChange={onRangeChange}
        />
      </View>
    </View>
  );
}
