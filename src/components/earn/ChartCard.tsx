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
    <View className="bg-canvas-raised rounded-[18px] border border-rule pt-[14px] pb-[10px] overflow-hidden">
      <View
        className="flex-row gap-[8px] px-[14px]"
        style={{
          alignItems: "baseline",
        }}
      >
        <Body className="text-[13px]" semibold>
          {quote.symbol}
        </Body>
        <Mono className="text-[11.5px] text-silver">{quote.price}</Mono>
        <Mono className="text-[11px]" color={color}>
          {quote.delta}
        </Mono>
      </View>

      <View className="mt-[10px]">
        <AreaChart data={data} height={height} color={color} />
      </View>

      <View className="px-[10px] mt-[10px]">
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
