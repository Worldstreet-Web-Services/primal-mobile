import { type ImageSource } from "expo-image";
import { useState } from "react";
import { View } from "react-native";

import {
  AssetList,
  ChartCard,
  type Asset,
  type Quote,
} from "@/components/earn";
import { ClockIcon, PlusIcon } from "@/components/icons";
import { BalanceSummary, type BalanceStats } from "@/components/trade";
import { Display, Label, OutlineButton, PILL, Screen } from "@/components/ui";
import {
  defaultRange,
  earnPortfolio as defaultBalance,
  kashHolding as defaultHolding,
  portfolio as defaultPortfolio,
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
  onFund?: () => void;
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
  onFund,
  onOpenAsset,
}: AutoEarnScreenProps) {
  const [range, setRange] = useState(defaultRange);

  return (
    <Screen pad={16} top={top} bottom={bottom}>
      <View
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 20,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
        }}
      >
        <BalanceSummary
          stats={balance}
          label="Earn portfolio"
          layout="amount-first"
          emphasizeCents
          artwork={artwork}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <OutlineButton
          label="Fund wallet"
          onPress={onFund}
          icon={
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: PILL,
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

      <View style={{ marginTop: 18 }}>
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
