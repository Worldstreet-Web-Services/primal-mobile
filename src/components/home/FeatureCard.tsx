import { type ImageSource } from "expo-image";
import { Text, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
import { PressableScale } from "../ui";
import { ArtSlot } from "./ArtSlot";

export type FeatureTone = "dark" | "brand";

export interface Feature {
  key: string;
  title: string;
  /** Small line above the title — the one-phrase pitch. */
  kicker?: string;
  /** The platform the capability is inherited from — "ark", "worldstreet"… */
  poweredBy?: string;
  tone?: FeatureTone;
  artwork?: ImageSource | number;
}

/**
 * A product doorway: the cutout illustration in the top-left corner, the name
 * anchored to the bottom-left. Art over title in a fixed frame, so cards of
 * different widths still line their names up across a row.
 *
 * It fills whatever the parent gives it — `FeatureGrid` owns the width.
 */
export function FeatureCard({
  feature,
  onPress,
  height = 114,
  artSize = 48,
  style,
}: {
  feature: Feature;
  onPress?: (key: string) => void;
  height?: number;
  /** Illustration square, in points. */
  artSize?: number;
  style?: ViewStyle;
}) {
  const brandTone = feature.tone === "brand";

  return (
    <PressableScale
      onPress={() => onPress?.(feature.key)}
      scale={0.97}
      style={style}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={feature.title}
        style={{
          height,
          borderRadius: 16,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          paddingHorizontal: 12,
          paddingVertical: 12,
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <ArtSlot
          source={feature.artwork}
          size={artSize}
          tint={brandTone ? C.brand : C.brandSoft}
        />

        {/* Title only — the card itself is the CTA (client call 2026-08).
            kicker/poweredBy stay in the data for the destination pages to
            show at their own footers. */}
        <Text
          numberOfLines={2}
          style={{
            fontFamily: F.displayBold,
            fontSize: 15,
            lineHeight: 18,
            letterSpacing: 0.2,
            color: C.text,
          }}
        >
          {feature.title.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * The doorway grid. `rows` is the shape of the block — `[3, 2]` puts three
 * cards on the first row and two wider ones on the second — and cards inside a
 * row split it evenly. Layout lives here rather than on the `Feature`, so the
 * same list can be laid out differently on another surface.
 *
 * Features beyond the configured rows keep filling rows of the last size.
 */
export function FeatureGrid({
  features,
  onOpen,
  rows = [3, 2],
  gap = 12,
  rowGap = 14,
  height = 114,
  artSize = 48,
}: {
  features: Feature[];
  onOpen?: (key: string) => void;
  /** Cards per row, in order. */
  rows?: number[];
  /** Between cards in a row. */
  gap?: number;
  /** Between rows. */
  rowGap?: number;
  height?: number;
  artSize?: number;
}) {
  const chunks: Feature[][] = [];
  for (let i = 0, r = 0; i < features.length; r++) {
    const size = rows[Math.min(r, rows.length - 1)] || 1;
    chunks.push(features.slice(i, i + size));
    i += size;
  }

  return (
    <View style={{ gap: rowGap }}>
      {chunks.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap }}>
          {row.map((feature) => (
            <FeatureCard
              key={feature.key}
              feature={feature}
              onPress={onOpen}
              height={height}
              artSize={artSize}
              // Even split of whatever the row has left after the gaps — a
              // short last row stretches to fill rather than leaving a hole.
              style={{ flex: 1 }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
