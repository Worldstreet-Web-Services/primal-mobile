import { type ImageSource } from "expo-image";
import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { GlassSurface, PressableScale } from "../ui";
import { ArtSlot } from "./ArtSlot";

export type FeatureTone = "dark" | "lime";

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
 * A promoted capability (auto-earn, copy trading…). The product render fills
 * the card and a translucent panel sits over its lower half carrying the copy
 * — so the art reads as the card, not as decoration beside it.
 */
export function FeatureCard({
  feature,
  onPress,
  height = 182,
}: {
  feature: Feature;
  onPress?: (key: string) => void;
  height?: number;
}) {
  const lime = feature.tone === "lime";

  return (
    <PressableScale
      onPress={() => onPress?.(feature.key)}
      style={{ flex: 1, minWidth: 132 }}
      scale={0.97}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={feature.title}
        style={{
          height,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: C.canvas,
          borderWidth: 1,
          borderColor: C.hairline,
        }}
      >
        {/* Art runs the full card; the panel below crops it optically. */}
        <ArtSlot
          fill
          contentFit="cover"
          contentPosition="left"
          source={feature.artwork}
          size={height * 0.66}
          tint={lime ? C.lime : C.leaf}
        />

        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 13,
            paddingTop: 12,
            paddingBottom: 14,
            borderTopLeftRadius: 25,
          }}
        >
          <GlassSurface bordered={false} />
          {/* Bright edge where the panel meets the art. */}
          {/* <Shine /> */}
          {lime ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(155,201,90,0.10)",
              }}
            />
          ) : null}

          {feature.kicker ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: F.body,
                fontSize: 11.5,
                color: C.silver,
              }}
            >
              {feature.kicker}
            </Text>
          ) : null}

          <Text
            numberOfLines={1}
            style={{
              fontFamily: F.display,
              fontSize: 19,
              letterSpacing: 0.2,
              color: C.text,
              marginTop: feature.kicker ? 5 : 0,
            }}
          >
            {feature.title.toUpperCase()}
          </Text>

          {feature.poweredBy ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: F.mono,
                fontSize: 8.5,
                letterSpacing: 1.2,
                marginTop: 7,
                color: C.sub,
              }}
            >
              {`POWERED BY ${feature.poweredBy}`.toUpperCase()}
            </Text>
          ) : null}
        </View>
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
    </View>
  );
}
