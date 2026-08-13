import { type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { PressableScale, Shine } from "../ui";
import { ArtSlot } from "./ArtSlot";

export type FeatureTone = "dark" | "lime";

export interface Feature {
  key: string;
  title: string;
  /** The platform the capability is inherited from — "ark", "worldstreet"… */
  poweredBy?: string;
  tone?: FeatureTone;
  artwork?: ImageSource | number;
}

/**
 * A promoted capability (auto-earn, copy trading…). Two tones so a row can
 * carry one loud card and one quiet one without either fighting the hero.
 */
export function FeatureCard({
  feature,
  onPress,
  height = 132,
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
      <LinearGradient
        colors={lime ? C.leafGrad : ["#1B2412", "#0C0E0B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height,
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: lime ? 0 : 1,
          borderColor: C.hairline,
          justifyContent: "flex-end",
          padding: 12,
        }}
        accessibilityRole="button"
        accessibilityLabel={feature.title}
      >
        <Shine />
        <ArtSlot
          source={feature.artwork}
          size={height * 0.78}
          tint={lime ? C.leafInk : C.leaf}
          style={{
            position: "absolute",
            right: -height * 0.06,
            top: height * 0.02,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.display,
            fontSize: 16,
            letterSpacing: 0.2,
            color: lime ? "#FFFFFF" : C.text,
          }}
        >
          {feature.title.toUpperCase()}
        </Text>
        {feature.poweredBy ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: F.mono,
              fontSize: 7.5,
              letterSpacing: 1.1,
              marginTop: 4,
              color: lime ? "rgba(255,255,255,0.82)" : C.sub,
            }}
          >
            {`POWERED BY ${feature.poweredBy}`.toUpperCase()}
          </Text>
        ) : null}
      </LinearGradient>
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
