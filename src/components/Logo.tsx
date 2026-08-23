import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";

/**
 * Which piece of brand artwork to draw.
 *
 * `green` is the brand mark and the default everywhere the logo is the subject
 * of the screen — welcome, splash, unlock, the payments hero. `white` is the
 * flat vector cut, for placements where the logo is furniture rather than the
 * point: headers, dense chrome, anywhere green would compete with the content
 * beside it. Reach for `white` only there.
 */
export type LogoVariant = "green" | "white" | "lockup" | "mark";

// Intrinsic sizes are recorded so the unset dimension can be derived — the mark
// never distorts, whatever one side is set to. Update these if the art is
// re-exported at a different size.
const SOURCES: Record<
  LogoVariant,
  { source: number; width: number; height: number }
> = {
  green: {
    source: require("../../assets/images/logo.png"),
    width: 1100,
    height: 1326,
  },
  white: {
    source: require("../../assets/images/kashplus_logo_small.png"),
    width: 124,
    height: 174,
  },
  // Kept so older call sites keep rendering, but both now resolve to the green
  // mark — there is one piece of brand artwork, and this is it.
  lockup: {
    source: require("@/assets/images/logo.png"),
    width: 1100,
    height: 1326,
  },
  mark: {
    source: require("@/assets/images/logo.png"),
    width: 1100,
    height: 1326,
  },
};

export function Logo({
  variant = "green",
  height,
  width,
  tint,
  className,
  style,
  accessibilityLabel = "KashPlus",
}: {
  variant?: LogoVariant;

  height?: number;
  /** Alternative driver — height follows instead. */
  width?: number;
  /** Render as a flat silhouette in this color. */
  tint?: string;
  /** Tailwind classes for the wrapper (NativeWind). */
  className?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const art = SOURCES[variant];
  const aspect = art?.width / art?.height;

  const box =
    width !== undefined
      ? { width, height: width / aspect }
      : { height: height ?? 28, width: (height ?? 28) * aspect };

  return (
    <View
      className={className}
      style={[box, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={art.source}
        contentFit="contain"
        tintColor={tint}
        style={{ width: "100%", height: "100%" }}
      />
    </View>
  );
}
