import { type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";

import { C, F } from "../../theme/tokens";
import { PlayIcon } from "../icons";
import { PressableScale } from "../ui";
import { ArtSlot } from "./ArtSlot";

export interface MediaItem {
  key: string;
  title: string;
  /** Kicker above the title — the format: "podcast", "hot news"… */
  kicker?: string;
  /** Who made it. */
  byline?: string;
  /** Runtime or read length, shown at the foot of the text column. */
  duration?: string;
  artwork?: ImageSource | number;
}

/**
 * Editorial card: artwork bleeding the full frame, the copy set in a scrimmed
 * column on the right half. The scrim runs left-to-right rather than bottom-up
 * — the art's subject sits on the left, so darkening downward would bury it
 * and still leave the type on a busy ground.
 */
export function MediaCard({
  item,
  onPress,
  width = 280,
  height = 140,
}: {
  item: MediaItem;
  onPress?: (key: string) => void;
  width?: number;
  height?: number;
}) {
  return (
    <PressableScale onPress={() => onPress?.(item.key)} scale={0.98}>
      <View
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={{
          width,
          height,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: C.raised,
        }}
      >
        <ArtSlot source={item.artwork} fill contentFit="cover" />

        <LinearGradient
          pointerEvents="none"
          colors={[
            "rgba(10,11,13,0.1)",
            "rgba(10,11,13,0.72)",
            "rgba(10,11,13,0.95)",
          ]}
          locations={[0, 0.42, 0.72]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            right: 0,
            width: "56%",
            paddingVertical: 14,
            paddingRight: 14,
            justifyContent: "center",
          }}
        >
          {item.kicker ? (
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 7.5,
                letterSpacing: 1.4,
                color: C.dim,
                marginBottom: 6,
              }}
            >
              {item.kicker.toUpperCase()}
            </Text>
          ) : null}

          <Text
            numberOfLines={2}
            style={{
              fontFamily: F.displayBold,
              fontSize: 16,
              lineHeight: 19,
              letterSpacing: 0.2,
              color: C.text,
            }}
          >
            {item.title.toUpperCase()}
          </Text>

          {item.byline ? (
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 7.5,
                letterSpacing: 1.2,
                color: C.dim,
                marginTop: 8,
              }}
            >
              {item.byline.toUpperCase()}
            </Text>
          ) : null}

          {item.duration ? (
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 7.5,
                letterSpacing: 1.2,
                color: C.dim,
                marginTop: 14,
              }}
            >
              {item.duration.toUpperCase()}
            </Text>
          ) : null}
        </View>

        <View style={{ position: "absolute", right: 14, bottom: 12 }}>
          <PlayIcon size={17} color={C.text} />
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Horizontal rail of media cards. `bleed` is the page gutter it should escape:
 * the rail runs edge to edge so the next card peeks past the screen's margin,
 * while the first one still lines up with everything above it.
 */
export function MediaCarousel({
  items,
  onOpen,
  gap = 12,
  bleed = 0,
  cardWidth,
  height = 140,
}: {
  items: MediaItem[];
  onOpen?: (key: string) => void;
  gap?: number;
  /** The horizontal padding of the page this sits in. */
  bleed?: number;
  /** Defaults to ~72% of the viewport, so the next card always peeks. */
  cardWidth?: number;
  height?: number;
}) {
  const { width } = useWindowDimensions();
  const w = cardWidth ?? Math.min(Math.round(width * 0.72), 320);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={w + gap}
      snapToAlignment="start"
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={{ paddingHorizontal: bleed, gap }}
    >
      {items.map((item) => (
        <MediaCard
          key={item.key}
          item={item}
          onPress={onOpen}
          width={w}
          height={height}
        />
      ))}
    </ScrollView>
  );
}
