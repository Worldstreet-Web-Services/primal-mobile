import { type ImageSource } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import {
  AssetList,
  ChartCard,
  type Asset,
  type Quote,
} from "@/components/earn";
import { ClockIcon, SparkleIcon } from "@/components/icons";
import { BalanceSummary, type BalanceStats } from "@/components/trade";
import { Display, Label, PrimaryButton, Screen } from "@/components/ui";
import {
  earnPortfolio as defaultBalance,
  kashHolding as defaultHolding,
  portfolio as defaultPortfolio,
  defaultRange,
  kashQuote,
  kashSeries,
  ranges,
} from "@/data/earn";
import { C } from "@/theme/tokens";

export interface AutoEarnScreenProps {
  balance?: BalanceStats;
  quote?: Quote;
  series?: number[];
  holding?: Asset[];
  portfolio?: Asset[];
  artwork?: ImageSource | number;
  /** Head space for the floating nav header. */
  top?: number;
  /** Tail space so the sticky action can't cover the last row. */
  bottom?: number;
  onBuy?: () => void;
  onOpenAsset?: (key: string) => void;
}

/**
 * Auto earn (PRD §F7): what the earn portfolio is worth, how Kash has moved,
 * and the positions behind the number. The buy action is sticky — it belongs
 * to the screen, not to any one row — so the route mounts it over this.
 */
export default function AutoEarnScreen({
  balance = defaultBalance,
  quote = kashQuote,
  series = kashSeries,
  holding = defaultHolding,
  portfolio = defaultPortfolio,
  artwork,
  top = 0,
  bottom = 190,
  onBuy,
  onOpenAsset,
}: AutoEarnScreenProps) {
  const [range, setRange] = useState(defaultRange);

  return (
    <Screen pad={13} top={top} bottom={bottom}>
      <View
        style={{
          marginTop: 12,
          padding: 18,
        }}
      >
        {/* Gain first, then the label, then the number — the move is what the
            glance is for, and the total confirms it. */}
        <BalanceSummary
          stats={balance}
          label="Trading balance"
          artwork={artwork}
        />

        {/* The buy action belongs to the balance it acts on, so it rides
            inside the card rather than floating over the page. */}
        <PrimaryButton
          label="Buy and hold"
          onPress={onBuy}
          icon={<SparkleIcon size={16} />}
          style={{ marginTop: 22 }}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <ChartCard
          quote={quote}
          data={series}
          ranges={ranges}
          activeRange={range}
          onRangeChange={setRange}
        />
      </View>

      <View style={{ marginTop: 4 }}>
        <AssetList assets={holding} framed={false} onOpen={onOpenAsset} />
      </View>

      {/* Rule above the section, not below the watch row — it belongs to the
          heading it introduces, so the two move together. */}
      <View
        style={{
          marginTop: 18,
          paddingTop: 18,
          borderTopWidth: 1,
          borderTopColor: C.hairline,
        }}
      >
        <Label>Market intelligence</Label>
        <Display size={22} style={{ marginTop: 10 }}>
          My Portfolio
        </Display>
      </View>

      <View style={{ marginTop: 14 }}>
        <AssetList
          assets={portfolio}
          subIcon={<ClockIcon size={12} />}
          onOpen={onOpenAsset}
        />
      </View>
    </Screen>
  );
}
