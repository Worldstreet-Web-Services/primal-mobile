import type { Context } from "react";
import { FlatList, ScrollView, View, useWindowDimensions } from "react-native";

import type { Trader } from "@/data/traders";
import { Avatar } from "../home/ProfileHeader";
import { StarIcon } from "../icons";
import { Body, MetalButton, Mono, PressableScale, QuietButton } from "../ui";

/**
 * The leaderboard, as two shapes of the same object.
 *
 * `TraderCard` is the featured rail — a portrait, the headline return and the
 * action, sized so the next card always peeks. `TraderRow` is the ranked list
 * underneath, which trades the portrait size for a rating and a market. Both
 * open the leader's profile on press; the Copy pill inside them is a separate
 * target, so mirroring never costs a round trip through the profile.
 */

/**
 * The context every `ScrollView` publishes to say it is scrolling its children.
 * RN sets it as a static on the component but leaves it out of the public
 * types, hence the cast — see `TraderList` for what reads it.
 */
const ScrollViewScope = (
  ScrollView as unknown as {
    Context: Context<{ horizontal: boolean } | null>;
  }
).Context;

/** Portrait with the in-market dot, shared by both shapes. */
function Portrait({ trader, size }: { trader: Trader; size: number }) {
  return (
    <View>
      <Avatar
        source={trader.avatar}
        initial={trader.name}
        size={size}
        ringClassName="border-border"
      />
      {trader.online ? (
        // Ringed in the surface colour rather than bordered — the ring's job is
        // to hold a gap between the dot and the portrait under it.
        <View className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 bg-green border-canvas-raised" />
      ) : null}
    </View>
  );
}

/** Trending flag. Rose, not brand green — a green flag beside a green return
    would read as part of the figure. */
function HotFlag() {
  return (
    <View className="rounded-md bg-down/10 px-2 py-1">
      <Mono className="text-[9.5px] text-down tracking-[1.2px]">HOT</Mono>
    </View>
  );
}

/** The Copy action, in the one place its two states are decided. */
function CopyAction({
  trader,
  onCopy,
  height,
}: {
  trader: Trader;
  onCopy?: (id: string) => void;
  height: number;
}) {
  const Pill = trader.copying ? QuietButton : MetalButton;
  return (
    <Pill
      label={trader.copying ? "Copying" : "Copy"}
      height={height}
      onPress={() => onCopy?.(trader.id)}
    />
  );
}

/** One featured leader — the card on the rail. */
export function TraderCard({
  trader,
  width = 200,
  onOpen,
  onCopy,
}: {
  trader: Trader;
  width?: number;
  onOpen?: (id: string) => void;
  onCopy?: (id: string) => void;
}) {
  return (
    <PressableScale
      onPress={() => onOpen?.(trader.id)}
      scale={0.97}
      accessibilityLabel={`${trader.name}, ${trader.roi} return. Open profile`}
    >
      <View
        className="rounded-3xl border border-rule bg-canvas-raised p-4"
        style={{ width }}
      >
        <View className="flex-row items-start justify-between">
          <Portrait trader={trader} size={54} />
          {trader.hot ? <HotFlag /> : null}
        </View>

        <Body
          className="text-[17px] font-body-semibold mt-[14px]"
          numberOfLines={1}
        >
          {trader.name}
        </Body>
        {trader.copiers ? (
          <Body
            className="text-[12.5px] text-dim mt-[3px]"

            numberOfLines={1}
          >
            {trader.copiers}
          </Body>
        ) : null}

        {/* The return and the word for it share a baseline: the figure carries
            the glance, the label only says what it is. */}
        <View className="mt-3 flex-row items-baseline gap-1.5">
          <Mono className="text-[16px] text-up">{trader.roi}</Mono>
          <Body className="text-[11px] text-dim">ROI</Body>
        </View>

        <View className="mt-4">
          <CopyAction trader={trader} onCopy={onCopy} height={42} />
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * The featured rail. Bleeds past the page gutter so the next card is cut by the
 * screen edge rather than by the padding — that cut is what says "scroll".
 */
export function TraderCarousel({
  traders,
  onOpen,
  onCopy,
  gutter = 16,
  gap = 12,
  cardWidth,
}: {
  traders: Trader[];
  onOpen?: (id: string) => void;
  onCopy?: (id: string) => void;
  /** The horizontal padding of the page this sits in. */
  gutter?: number;
  gap?: number;
  /** Defaults to ~48% of the viewport, so two fit and the third peeks. */
  cardWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const w = cardWidth ?? Math.min(Math.round(width * 0.48), 220);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={w + gap}
      snapToAlignment="start"
      // Negative margin cancels the page gutter; the content container puts it
      // back as padding, so the first card still lines up with everything above.
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={{ paddingHorizontal: gutter, gap }}
    >
      {traders.map((trader) => (
        <TraderCard
          key={trader.id}
          trader={trader}
          width={w}
          onOpen={onOpen}
          onCopy={onCopy}
        />
      ))}
    </ScrollView>
  );
}

/** One ranked leader — the list row. */
export function TraderRow({
  trader,
  onOpen,
  onCopy,
  last,
}: {
  trader: Trader;
  onOpen?: (id: string) => void;
  onCopy?: (id: string) => void;
  last?: boolean;
}) {
  return (
    <PressableScale
      onPress={() => onOpen?.(trader.id)}
      scale={0.99}
      accessibilityLabel={`${trader.name}, ${trader.roi} return. Open profile`}
    >
      {/* Padding lives on the row, not the list, so the separator runs the
          card's full width instead of stopping short at the gutter. */}
      <View
        className={`flex-row items-center gap-3 px-4 py-3.5 ${
          last ? "" : "border-b border-rule"
        }`}
      >
        <Portrait trader={trader} size={44} />

        <View className="flex-1">
          <Body className="text-[15px] font-body-semibold" numberOfLines={1}>
            {trader.name}
          </Body>
          <View className="mt-1 flex-row items-center gap-1">
            {trader.rating ? (
              <>
                <StarIcon size={12} />
                <Body className="text-[12px] text-dim">{trader.rating}</Body>
              </>
            ) : null}
            {trader.rating && trader.market ? (
              <Body className="text-[12px] text-dim">·</Body>
            ) : null}
            {trader.market ? (
              <Body className="text-[12px] text-dim">{trader.market}</Body>
            ) : null}
          </View>
        </View>

        <View className="items-end">
          <Body className="text-[10.5px] text-dim">
            {trader.roiPeriod ? `ROI (${trader.roiPeriod})` : "ROI"}
          </Body>
          <Mono className="text-[14px] text-up mt-[2px]">{trader.roi}</Mono>
        </View>

        <CopyAction trader={trader} onCopy={onCopy} height={34} />
      </View>
    </PressableScale>
  );
}

/**
 * One row's height: the 44pt portrait inside its 14pt padding, plus the
 * hairline under it. Exported so a caller can floor the list at a whole number
 * of rows rather than guessing at a pixel figure.
 */
export const TRADER_ROW_HEIGHT = 73;

/** The ranked leaders in one card, hairline-separated. */
export function TraderList({
  traders,
  onOpen,
  onCopy,
  scrollable = false,
}: {
  traders: Trader[];
  onOpen?: (id: string) => void;
  onCopy?: (id: string) => void;
  /**
   * Give the list a viewport of its own: the card fills the height its parent
   * hands it and scrolls inside that, instead of running the full length of the
   * page. The PARENT sets the height — `flex-1`, a `minHeight`, or both — so
   * this only says which of the two scrolls.
   */
  scrollable?: boolean;
}) {
  const list = (
    <FlatList
      data={traders}
      keyExtractor={(trader) => trader.id}
      renderItem={({ item, index }) => (
        <TraderRow
          trader={item}
          onOpen={onOpen}
          onCopy={onCopy}
          last={index === traders.length - 1}
        />
      )}
      // Whose scroll this is. Laid out whole inside the page's scroll by
      // default; on its own when the parent bounds it.
      scrollEnabled={scrollable}
      // Android only, and required there: a scroll view nested in another one
      // does not receive the gesture unless it asks for it.
      nestedScrollEnabled
      // iOS only, and deliberate: the page under this one carries the pull to
      // refresh, so the page should own the only rubber band on screen. A list
      // that bounced at its top would look like it was about to refresh and
      // then not.
      bounces={false}
      // Defaults to true on Android, where a short list inside a page scroll
      // never gets the scroll event that would unclip its rows — so they blank
      // out. Nothing here is long enough for the clipping to buy anything.
      removeClippedSubviews={false}
      ListEmptyComponent={
        <View className="px-4 py-6">
          <Body className="text-[13px] text-dim">No traders to copy yet.</Body>
        </View>
      }
    />
  );

  return (
    // The card chrome stays on the wrapper rather than on the list: the border
    // and the clip belong to the surface, and the list is only what fills it.
    <View
      className={`overflow-hidden rounded-3xl border border-rule bg-canvas-raised ${
        scrollable ? "flex-1" : ""
      }`}
    >
      {scrollable ? (
        // The list has its own viewport now, so the page's scroll is not the one
        // windowing it. Clearing the context says exactly that, and is what
        // keeps RN's nested-list error — which is aimed at lists that share the
        // page's scroll — off one that does not. It is read in a single
        // dev-only branch of `VirtualizedList` and nowhere else.
        <ScrollViewScope.Provider value={null}>{list}</ScrollViewScope.Provider>
      ) : (
        list
      )}
    </View>
  );
}
