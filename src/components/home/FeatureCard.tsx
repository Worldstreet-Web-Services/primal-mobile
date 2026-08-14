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
  artSize = 35,
  wide = false,
  wideHeight = 112,
}: {
  feature: Feature;
  onPress?: (key: string) => void;
  /** Illustration square, in points. */
  artSize?: number;
  /** Span the whole row instead of sharing it — see `FeatureShelf`. */
  wide?: boolean;
  wideHeight?: number;
}) {
  const brandTone = feature.tone === "brand";

  return (
    <PressableScale
      onPress={() => onPress?.(feature.key)}
      // width:100% claims its own line in the wrapping row.
      style={wide ? { width: "100%" } : { flex: 1, minWidth: 132 }}
      scale={0.97}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={feature.title}
        style={{
          // Square tiles take their side from the column's flex width. The
          // wide variant can't do that — a full-width square would be enormous
          // — so it takes a fixed height and lays its content out in a row.
          ...(wide
            ? {
                height: wideHeight,
                flexDirection: "row" as const,
                justifyContent: "flex-start" as const,
                gap: 16,
                paddingHorizontal: 24,
              }
            : {
                aspectRatio: 1,
                justifyContent: "center" as const,
                paddingHorizontal: 12,
              }),
          alignItems: "center",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: C.hairline,
          // Ground stays transparent so the cutout illustrations keep reading
          // as art on the canvas — the border frames them, it doesn't box them.
          backgroundColor: "transparent",
        }}
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
            marginTop: wide ? 0 : 8,
          }}
        >
          {feature.title.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * Two-up shelf. An odd count would leave a hole in the last row, so the
 * trailing card spans the full width instead — the grid always closes flush.
 */
export function FeatureShelf({
  features,
  onOpen,
}: {
  features: Feature[];
  onOpen?: (key: string) => void;
}) {
  const lastIndex = features.length - 1;
  const oddCount = features.length % 2 === 1;

  return (
    <View style={{ flexDirection: "row", gap: 11, flexWrap: "wrap" }}>
      {features.map((feature, i) => (
        <FeatureCard
          key={feature.key}
          feature={feature}
          onPress={onOpen}
          wide={oddCount && i === lastIndex}
        />
      ))}
    </View>
  );
}
