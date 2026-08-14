import { type ImageSource } from "expo-image";
import { Text, View } from "react-native";

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
 * A promoted capability (auto-earn, copy trading…). Client call 2026-08: no
 * boxed CTA — the cutout illustration floats on the canvas and the copy sits
 * beneath it. The tap target is the whole column.
 */
export function FeatureCard({
  feature,
  onPress,
  artSize = 128,
}: {
  feature: Feature;
  onPress?: (key: string) => void;
  /** Illustration square, in points. */
  artSize?: number;
}) {
  const brandTone = feature.tone === "brand";

  return (
    <PressableScale
      onPress={() => onPress?.(feature.key)}
      style={{ flex: 1, minWidth: 132 }}
      scale={0.97}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={feature.title}
        style={{ alignItems: "center", paddingVertical: 6 }}
      >
        <ArtSlot
          source={feature.artwork}
          size={artSize}
          tint={brandTone ? C.brand : C.brandSoft}
        />

        {/* Title only — the CTA reads as an icon (client call 2026-08).
            kicker/poweredBy stay in the data for the destination pages to
            show at their own footers. */}
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.display,
            fontSize: 18,
            letterSpacing: 0.3,
            color: C.text,
            marginTop: 8,
          }}
        >
          {feature.title.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Two-up shelf of feature cards. */
export function FeatureShelf({
  features,
  onOpen,
}: {
  features: Feature[];
  onOpen?: (key: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 11, flexWrap: "wrap" }}>
      {features.map((feature) => (
        <FeatureCard key={feature.key} feature={feature} onPress={onOpen} />
      ))}
      {/* Odd count: a spacer keeps the last icon at half width instead of
          letting flex stretch it across the whole row. */}
      {features.length % 2 === 1 ? (
        <View style={{ flex: 1, minWidth: 132 }} />
      ) : null}
    </View>
  );
}
