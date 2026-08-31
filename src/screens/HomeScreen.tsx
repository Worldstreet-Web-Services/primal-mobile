import { type ImageSource } from "expo-image";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

/**
 * Room at the foot of the page for the native tab bar.
 *
 * The page scrolls UNDER the bar on iOS and nothing insets it for us.
 * `NativeTabs` does ask UIKit for automatic content-inset adjustment, but the
 * native side finds the scroll view to adjust by walking `subviews[0]` down
 * from the screen — `RNSScrollViewFinder.findScrollViewInFirstDescendantChain`
 * — and the first child here is the fixed greeting block, not the scroll view.
 * The walk dead-ends there, the adjustment lands on nothing, and the last card
 * sits behind the bar.
 *
 * Android needs no allowance: expo-router already wraps the screen in a
 * bottom-edge `SafeAreaView` there, so the scroll view ends above the bar.
 *
 * The height is stated rather than measured because neither expo-router nor
 * `react-native-safe-area-context` reports it — the provider is mounted at the
 * app root, so its bottom inset is the home indicator alone, which is why that
 * is added on top rather than assumed to include this. A little over UIKit's
 * 49pt standard, since the iOS 26 glass bar floats clear of the indicator.
 */
const TAB_BAR = Platform.select({ ios: 56, default: 0 });

/** Breathing room between the last card and the bar. */
const TAIL = 16;

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
  /**
   * Pull to refresh. Absent, the page still bounces and re-reads nothing —
   * so wire both or neither.
   */
  refreshing?: boolean;
  onRefresh?: () => void;
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
  refreshing = false,
  onRefresh,
  sectionLabel = "Explore",
  activityLabel = "Recent Transaction",
  onOpenFeature,
  onNotifications,
  onOpenProfile,
  onDeposit,
  onTransfer,
}: HomeScreenProps) {
  const clearance = useMiniPlayerClearance();
  const insets = useSafeAreaInsets();

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

      {/* The scroll tail clears the tab bar, the home indicator under it,
          and the docked podcast bar when one is up. */}
      <Screen
        bottom={TAIL + TAB_BAR + insets.bottom + clearance}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
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
