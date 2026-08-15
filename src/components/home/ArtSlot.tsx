import { Image, type ImageContentPosition, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View, type ViewStyle } from "react-native";

import { C } from "../../theme/tokens";

/**
 * Artwork well used by the hero and the ecosystem cards. Renders the supplied
 * product render when there is one, and a glassy placeholder object when there
 * isn't — so the layout is final before the art lands.
 */
export function ArtSlot({
  source,
  size = 120,
  style,
  tint = C.brandSoft,
  fill = false,
  contentFit = "contain",
  contentPosition = "center",
}: {
  source?: ImageSource | number;
  size?: number;
  style?: ViewStyle;
  tint?: string;
  /** Stretch to the parent instead of holding a square of `size`. */
  fill?: boolean;
  contentFit?: "contain" | "cover";
  /** Which edge the art anchors to when `contentFit` crops it. */
  contentPosition?: ImageContentPosition;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        fill
          ? { width: "100%", height: "100%" }
          : { width: size, height: size },
        style,
      ]}
      accessible={false}
    >
      {source ? (
        <Image
          source={source}
          contentFit={contentFit}
          contentPosition={contentPosition}
          style={{
            width: "100%",
            height: "100%",
          }}
          transition={200}
        />
      ) : (
        <GlassObject size={size} tint={tint} />
      )}
    </View>
  );
}

/** Placeholder: a tilted glass capsule catching a rim light. */
function GlassObject({ size, tint }: { size: number; tint: string }) {
  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          width: size * 0.86,
          height: size * 0.86,
          borderRadius: size,
          backgroundColor: tint,
          opacity: 0.13,
        }}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.04)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{
          width: size * 0.62,
          height: size * 0.72,
          borderRadius: size * 0.24,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.22)",
          transform: [{ rotate: "-12deg" }],
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: size * 0.1,
            left: size * 0.12,
            width: size * 0.38,
            height: size * 0.2,
            borderRadius: size * 0.2,
            backgroundColor: tint,
            opacity: 0.55,
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: size * 0.08,
            right: size * 0.1,
            width: size * 0.18,
            height: size * 0.18,
            borderRadius: size * 0.09,
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        />
      </LinearGradient>
    </View>
  );
}
