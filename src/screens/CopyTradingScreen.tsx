import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ChevronRightIcon,
  PlusIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";
import { TraderCarousel, TraderList } from "@/components/trade";
import { Body, Display, MetalButton, PressableScale } from "@/components/ui";
import {
  copyPositionCount,
  copyTradingPortfolio,
  featuredTraders as defaultFeatured,
  rankedTraders as defaultRanked,
  type Trader,
} from "@/data/traders";
import { C } from "@/theme/tokens";

/** Page gutter. The featured rail bleeds past it, so it has to be shared. */
const GUTTER = 16;

/**
 * The shortest the ranked list is allowed to get.
 *
 * The list takes the height everything else on the page did not, which is what
 * keeps the copy-positions card under it on screen — reading the leaders should
 * never cost you sight of what you already copy. This is the floor under that
 * arithmetic, and it has to be LOW, because the page above the list is 528pt of
 * cards and rail: an iPhone 14 has 173pt left over, which is 2.4 rows. A floor
 * of three rows does not leave the list short, it pushes the card off the
 * bottom — which is the whole thing this sizing exists to prevent.
 *
 * Two rows still reads as a list. Where even that does not fit (an SE has 57pt
 * of slack), the page scrolls the difference rather than swallowing the card —
 * see the root view below for what makes that possible.
 */

export interface CopyTradingScreenProps {
  /** The trading wallet. Preformatted — the UI never does the math. */
  portfolio?: { label: string; amount: string };
  /** The rail at the top: who is running hot. */
  featured?: Trader[];
  /** The ranked list underneath. */
  traders?: Trader[];
  /** How many leaders the member currently mirrors. */
  copyingCount?: number;
  /** A refresh is in flight — drives the pull spinner. */
  refreshing?: boolean;
  /** Pull down from the top of the page to refresh everything on it. */
  onRefresh?: () => void;
  onDeposit?: () => void;
  onSeeAll?: () => void;
  /** Opens a leader's profile — the whole card and row are this target. */
  onOpenTrader?: (id: string) => void;
  /** Mirrors a leader. Its own target inside the card, so copying never costs
      a round trip through the profile. */
  onCopy?: (id: string) => void;
  onOpenPositions?: () => void;
  top?: number;
}

/** Section heading, with the optional way out to the full list. */
function SectionHeader({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View className="mb-3.5 mt-7 flex-row items-center justify-between">
      <Body className="text-[17px] font-body-semibold">{title}</Body>
      {/* Drawn as a plain label until something is behind it — a chevron that
          answers a tap with nothing is worse than no chevron. */}
      {action ? (
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          hitSlop={10}
          accessibilityRole={onPress ? "button" : undefined}
          accessibilityLabel={onPress ? `${action} ${title}` : undefined}
          className="flex-row items-center gap-1"
        >
          <Body className="text-[13.5px] text-sub">{action}</Body>
          <ChevronRightIcon size={14} color={C.sub} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Icon tile — the same square in front of every summary row on this screen. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card">
      {children}
    </View>
  );
}

/**
 * Copy trading (PRD §F6): what the trading wallet holds and how to add to it,
 * then the leaders available to mirror — the hot ones on a rail, the ranked
 * ones in a list — and finally what the member is already copying.
 *
 * The screen shows PEOPLE, not positions. A leader's open trades belong on the
 * profile behind them, which is why every card here opens `/copy-trading/:id`
 * rather than expanding in place.
 *
 * Nothing on this screen is sourced. Worldstreet owns the endpoints and none of
 * them exist yet, so the figures come from `src/data/traders.ts` and the tile
 * on home says PREVIEW on the door.
 */
export default function CopyTradingScreen({
  portfolio = copyTradingPortfolio,
  featured = defaultFeatured,
  traders = defaultRanked,
  copyingCount = copyPositionCount,
  refreshing = false,
  onRefresh,
  onDeposit,
  onSeeAll,
  onOpenTrader,
  onCopy,
  onOpenPositions,
  top = 0,
}: CopyTradingScreenProps) {
  const copyingLine =
    copyingCount > 0
      ? `You are copying ${copyingCount} trader${copyingCount === 1 ? "" : "s"}`
      : "You are not copying anyone yet";

  const insets = useSafeAreaInsets();

  return (
    // Pull to refresh is a gesture on the PAGE, so the page is what has to be
    // pullable — hence a scroll view around a layout that is sized not to
    // scroll. `flexGrow` is what keeps that true: the content still fills the
    // viewport exactly, the ranked list still takes what the cards left over,
    // and the page only genuinely scrolls on a device too short to fit it. A
    // vertical scroll view bounces past its top even with nothing to scroll,
    // and that bounce is the pull.
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, marginTop: top }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          // Inked from the palette on both platforms: the stock spinner is iOS
          // grey and Android blue, and neither belongs on a black canvas.
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.brand}
            colors={[C.brand]}
            progressBackgroundColor={C.raised}
          />
        ) : undefined
      }
    >
      {/* `grow`, and specifically NOT `flex-1`.

          Both fill the viewport when the content is short, which is what sizes
          the list. They differ when it is not: `flex-1` sets a flex basis of 0,
          so the page measures as nothing at all and the scroll view above finds
          nothing to scroll — the overflow is simply clipped, and the card at the
          foot cannot be reached by any gesture. `grow` keeps the basis on the
          real content, so a page that does not fit scrolls by exactly what it
          overflows by. */}
      <View
        className="grow"
        style={{
          paddingHorizontal: GUTTER,
          // Nothing floats over the foot of this screen, so the last card only
          // has to clear the home indicator.
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* <Body className="text-[13.5px] text-dim text-center">
          Copy top traders. Grow together.
        </Body> */}

        <View className="mt-5 flex-row items-center gap-3 rounded-3xl border border-rule bg-canvas-raised p-4">
          <Glyph>
            <WalletIcon size={22} color={C.silver} />
          </Glyph>
          <View className="flex-1">
            <Body className="text-[13px] text-dim">{portfolio.label}</Body>
            <Display className="text-[24px] leading-[25.2px] mt-[2px]">
              {portfolio.amount}
            </Display>
          </View>
          <MetalButton
            label="Deposit"
            height={44}
            icon={<PlusIcon size={15} color={C.metalInk} />}
            onPress={onDeposit}
          />
        </View>
        <PressableScale
          onPress={onOpenPositions}
          scale={0.99}
          accessibilityLabel={`${copyingLine}. Open your copy positions`}
        >
          <View className="mt-4 flex-row items-center gap-3 rounded-3xl border border-rule bg-canvas-raised p-4">
            <Glyph>
              <UsersIcon size={21} color={C.silver} />
            </Glyph>
            <View className="flex-1">
              <Body className="text-[15px] font-body-semibold">
                Your Copy Positions
              </Body>
              <Body className="text-[12.5px] text-dim mt-[2px]">
                {copyingLine}
              </Body>
            </View>
            <ChevronRightIcon size={18} color={C.dim} />
          </View>
        </PressableScale>

        <SectionHeader
          title="Top Traders"
          action="See All"
          onPress={onSeeAll}
        />

        <TraderCarousel
          traders={featured}
          gutter={GUTTER}
          onOpen={onOpenTrader}
          onCopy={onCopy}
        />

        {/* `flex-1` claims the leftover, `minHeight` refuses to go under three
          rows — between them the list is sized by the device rather than by a
          number picked here, and it scrolls inside whatever it ends up with. */}
        <View className="mt-6 flex-1">
          <TraderList
            traders={traders}
            onOpen={onOpenTrader}
            onCopy={onCopy}
            scrollable
          />
        </View>
      </View>
    </ScrollView>
  );
}
