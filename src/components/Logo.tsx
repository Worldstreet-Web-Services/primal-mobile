import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";

/** Which piece of brand artwork to draw. */
export type LogoVariant = "lockup" | "mark";

// Intrinsic sizes are recorded so the unset dimension can be derived — the mark
// never distorts, whatever one side is set to. Update these if the art is
// re-exported at a different size.
const SOURCES: Record<
  LogoVariant,
  { source: number; width: number; height: number }
> = {
  lockup: {
    source: require("../../assets/images/logo.png"),
    width: 1007,
    height: 1320,
  },
  mark: {
    source: require("../../assets/images/logo_2.png"),
    width: 195,
    height: 195,
  },
};

/**
 * The Paradigm logo. `lockup` is the full artwork; `mark` is the standalone
 * glyph for tight placements (splash, headers, avatars).
 *
 * Size it by `height` or `width` and the other dimension follows the artwork's
 * ratio — never set both unless you mean to distort it.
 *
 * `tint` recolors it as a solid silhouette, for placements where the full-color
 * mark fights its ground (a brand-filled button, a single-color header).
 */
export function Logo({
  variant = "lockup",
  height,
  width,
  tint,
  className,
  style,
  accessibilityLabel = "Paradigm",
}: {
  variant?: LogoVariant;
  /** Drives the size; width follows the aspect ratio. Defaults to 28. */
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
  const aspect = art.width / art.height;

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
