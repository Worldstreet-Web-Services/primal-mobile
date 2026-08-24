import { View, type ViewStyle } from "react-native";

import { ArtSlot } from "../home";

/**
 * The episode's cover, as both the page and the player draw it: one rounded
 * letterbox, cropped to fill.
 *
 * Shared rather than written twice because the artwork is the element the
 * minimise gesture animates between — the two surfaces have to agree on the
 * ratio and the corner, or the player appears to change shape on the way down.
 */
export function EpisodeArt({
  source,
  width,
  ratio = 1.47,
  radius = 16,
  style,
}: {
  source?: number;
  width: number;
  /** Width ÷ height. The design's shallow letterbox. */
  ratio?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  return (
    <View
      className="overflow-hidden bg-canvas-inset"
      style={[
        { width, height: Math.round(width / ratio), borderRadius: radius },
        style,
      ]}
    >
      <ArtSlot source={source} fill contentFit="cover" size={width * 0.4} />
    </View>
  );
}
