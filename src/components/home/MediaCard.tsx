import { type ImageSource } from "expo-image";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { C } from "../../theme/tokens";
import { PlayIcon } from "../icons";
import { PILL, PressableScale } from "../ui";
import { ArtSlot } from "./ArtSlot";
import { cn } from "@/lib/cn";

/** Which shelf an item belongs to — the two the rail can switch between. */
export type MediaKind = "podcast" | "news";

export interface MediaItem {
  key: string;
  title: string;
  /** Kicker above the title — "now playing", the issue date… */
  kicker?: string;
  /** Who made it. */
  byline?: string;
  /** Runtime or read length, shown beside the byline. */
  duration?: string;
  /** Which tab shows it. Items without one show under every tab. */
  kind?: MediaKind;
  /** Overrides the CTA label; defaults per kind. */
  actionLabel?: string;
  artwork?: ImageSource | number;
}

/** Text sitting on the brand panel — ink, never white. */
const INK_SOFT = "rgba(10,20,5,0.62)";

/** Card proportions from the design: a wide, shallow letterbox. */
const CARD_RATIO = 2.5;
/** How much of the card the copy takes; the artwork gets the rest. */
const COPY_SHARE = 0.63;

/**
 * Editorial card: a brand-filled panel of copy with the artwork butted against
 * it, full-bleed to the card's edge. The split is hard rather than a gradient
 * scrim — the copy needs a flat ground to sit ink on, and the photograph keeps
 * its own frame instead of being darkened to make room for type.
 */
export function MediaCard({
  item,
  onPress,
  width = 300,
  height = Math.round(300 / CARD_RATIO),
}: {
  item: MediaItem;
  onPress?: (key: string) => void;
  width?: number;
  height?: number;
}) {
  const action =
    item.actionLabel ?? (item.kind === "news" ? "Read now" : "Play now");

  return (
    <PressableScale onPress={() => onPress?.(item.key)} scale={0.98}>
      <View
        accessibilityRole="button"
        accessibilityLabel={item.title}
        className="rounded-[20px] overflow-hidden flex-row bg-brand"
        style={{
          width,
          height,
        }}
      >
        <View
          className="px-[14px] py-[13px] justify-between"
          style={{
            flex: COPY_SHARE,
          }}
        >
          <View>
            {item.kicker ? (
              <Text
                className="font-mono text-[7px] tracking-[1.6px] mb-[8px]"
                style={{
                  color: INK_SOFT,
                }}
              >
                {item.kicker.toUpperCase()}
              </Text>
            ) : null}

            <Text
              numberOfLines={3}
              className="font-display-bold text-[16px] leading-[19px] tracking-[0.2px] text-brand-ink"
            >
              {item.title.toUpperCase()}
            </Text>

            {item.byline || item.duration ? (
              <Text
                numberOfLines={1}
                className="font-mono text-[6.5px] tracking-[1.1px] mt-[7px]"
                style={{
                  color: INK_SOFT,
                }}
              >
                {[item.byline, item.duration]
                  .filter(Boolean)
                  .join(" · ")
                  .toUpperCase()}
              </Text>
            ) : null}
          </View>

          {/* Reads as the card's own control, so it takes the canvas fill —
              the one dark shape on the panel is where the tap goes. */}
          <View
            className="self-start flex-row items-center gap-[7px] h-[24px] px-[11px] bg-canvas"
            style={{
              borderRadius: PILL,
            }}
          >
            <Text className="font-mono-semibold text-[7.5px] tracking-[1.3px] text-text">
              {action.toUpperCase()}
            </Text>
            <PlayIcon size={8} color={C.text} />
          </View>
        </View>

        <View style={{ flex: 1 - COPY_SHARE, backgroundColor: "white" }}>
          <ArtSlot
            source={item.artwork}
            fill
            contentFit="cover"
            size={height * 0.55}
          />
        </View>
      </View>
    </PressableScale>
  );
}

const TABS: { kind: MediaKind; label: string }[] = [
  { kind: "podcast", label: "Podcast" },
  { kind: "news", label: "News" },
];

/**
 * The rail's own switch. The selected shelf takes a filled pill with brand
 * lettering; the other is an outline — so the pair reads as one control rather
 * than two buttons.
 */
function MediaTabs({
  active,
  onChange,
}: {
  active: MediaKind;
  onChange: (kind: MediaKind) => void;
}) {
  return (
    <View className="flex-row justify-center gap-[12px] mb-[18px]">
      {TABS.map(({ kind, label }) => {
        const on = kind === active;
        return (
          <Pressable
            key={kind}
            onPress={() => onChange(kind)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className="h-[42px] px-[26px] items-center justify-center border"
            style={{
              borderRadius: PILL,
              backgroundColor: on ? C.raised : "transparent",
              borderColor: on ? "transparent" : C.brand,
            }}
          >
            <Text
              className={cn(
                "font-mono-semibold text-[11px] tracking-[3px]",
                on ? "text-brand" : "text-text",
              )}
            >
              {label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Horizontal rail of media cards under its own shelf switch. `bleed` is the
 * page gutter it should escape: the rail runs edge to edge so the next card
 * peeks past the screen's margin, while the first still lines up with
 * everything above it.
 *
 * The switch only appears once the data actually splits into shelves — a list
 * that declares no `kind` is shown whole, with no control to press.
 */
export function MediaCarousel({
  items,
  onOpen,
  gap = 12,
  bleed = 0,
  cardWidth,
  height,
}: {
  items: MediaItem[];
  onOpen?: (key: string) => void;
  gap?: number;
  /** The horizontal padding of the page this sits in. */
  bleed?: number;
  /** Defaults to ~83% of the viewport, so the next card always peeks. */
  cardWidth?: number;
  /** Defaults to the design's letterbox ratio. */
  height?: number;
}) {
  const { width } = useWindowDimensions();
  const w = cardWidth ?? Math.min(Math.round(width * 0.83), 360);
  const h = height ?? Math.round(w / CARD_RATIO);

  const [kind, setKind] = useState<MediaKind>("podcast");

  const kinded = items.some((item) => item.kind);
  const shown = useMemo(
    () =>
      kinded ? items.filter((item) => !item.kind || item.kind === kind) : items,
    [items, kind, kinded],
  );

  return (
    <View>
      {kinded ? <MediaTabs active={kind} onChange={setKind} /> : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={w + gap}
        snapToAlignment="start"
        style={{ marginHorizontal: -bleed }}
        contentContainerStyle={{ paddingHorizontal: bleed, gap }}
      >
        {shown.map((item) => (
          <MediaCard
            key={item.key}
            item={item}
            onPress={onOpen}
            width={w}
            height={h}
          />
        ))}
      </ScrollView>
    </View>
  );
}
