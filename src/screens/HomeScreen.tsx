import { type ImageSource } from "expo-image";
import { View } from "react-native";

import {
  ActivityCard,
  FeatureTileGrid,
  GreetingBlock,
  PortfolioCard,
  SectionTitle,
  type ActivityItem,
  type FeatureTileItem,
  type PortfolioDelta,
  type PortfolioView,
} from "@/components/home";
import { useMiniPlayerClearance } from "@/components/podcast";
import { Screen } from "@/components/ui";

/** Page gutter. The media rail escapes it, so it has to be shared. */
const GUTTER = 14;

export type { PortfolioView };

export interface HomeScreenProps {
  greeting: string;
  /** First name — the greeting block has room for one line. */
  name: string;
  /** The member's portrait. Falls back to a glyph on a white disc. */
  avatar?: ImageSource | number;
  unread?: boolean;
  /**
   * The hero figure. Required: there is no default, because there is no truth
   * this file could supply on its own.
   */
  portfolio: PortfolioView;
  /** The reference's green move line. Absent unless something can compute it. */
  delta?: PortfolioDelta;
  /** Eye state, hoisted so it survives this screen being remounted. */
  masked: boolean;
  onToggleMasked: () => void;
  /** The doorways, with how real each one is. Any count; the grid reflows. */
  features: FeatureTileItem[];
  /** Recent activity. Empty renders the card's honest empty state. */
  activity?: ActivityItem[];
  sectionLabel?: string;
  activityLabel?: string;
  /** Head space — safe-area top, or a nav header's height when one floats. */
  top?: number;
  /** Which tab is lit. The bar is drawn here because home is a tab root. */
  tab?: string;
  onSelectTab?: (key: string) => void;
  onOpenFeature?: (key: string) => void;
  onOpenMedia?: (key: string) => void;
  onNotifications?: () => void;
  onOpenProfile?: () => void;
  onDeposit?: () => void;
  onTransfer?: () => void;
}

export default function HomeScreen({
  greeting,
  name,
  avatar,
  unread = false,
  portfolio,
  delta,
  masked,
  onToggleMasked,
  features,
  activity = [],
  sectionLabel = "Explore",
  activityLabel = "Recent Transaction",
  top = 0,
  tab = "home",
  onSelectTab,
  onOpenFeature,
  onNotifications,
  onOpenProfile,
  onDeposit,
  onTransfer,
}: HomeScreenProps) {
  const clearance = useMiniPlayerClearance();

  return (
    <View className="flex-1 bg-canvas">
      <GreetingBlock
        greeting={greeting}
        name={name}
        avatar={avatar}
        unread={unread}
        onNotifications={onNotifications}
        onProfilePress={onOpenProfile}
      />

      {/* Bottom padding clears the docked podcast bar when one is up. */}
      <Screen bottom={40 + clearance}>
        <PortfolioCard
          view={portfolio}
          hidden={masked}
          onToggleHidden={onToggleMasked}
          delta={delta}
          onDeposit={onDeposit}
          onTransfer={onTransfer}
          style={{ marginTop: 22 }}
        />

        <SectionTitle style={{ marginTop: 30 }}>{sectionLabel}</SectionTitle>

        <View className="mt-[14px]">
          <FeatureTileGrid items={features} onOpen={onOpenFeature} />
        </View>

        <SectionTitle style={{ marginTop: 32 }}>{activityLabel}</SectionTitle>

        <View className="mt-[14px]">
          <ActivityCard items={activity} />
        </View>
      </Screen>

      {/* <TabBar active={tab} onSelect={onSelectTab} /> */}
    </View>
  );
}
