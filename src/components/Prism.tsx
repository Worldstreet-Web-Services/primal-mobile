import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import type { ViewStyle } from "react-native";

import { C } from "../theme/tokens";

/**
 * Refracted light pooling where glass meets the mark behind it — the smear that
 * bleeds through a drawer's top-left corner or sits behind a headline.
 *
 * Every hue comes off the brand ramp: the iridescence is carried by value, not
 * by borrowed hues, so a rebrand is a token change and nothing here moves.
 * Drawn with radial stops that fall to zero alpha, since there is no cheap blur
 * on either platform and stacked linear gradients read as banding.
 */
export function Prism({
  width,
  intensity = 1,
  style,
}: {
  /** Draw width. Overhang the container and let it clip for a corner smear. */
  width: number;
  /** 0–1 presence. */
  intensity?: number;
  style?: ViewStyle;
}) {
  return (
    <Svg
      pointerEvents="none"
      width={width}
      height={210}
      opacity={intensity}
      style={[{ position: "absolute" }, style]}
    >
      <Defs>
        {/* Highlight: the top of the brand gradient, where the light lands. */}
        <RadialGradient id="hi" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={C.brandGrad[0]} stopOpacity={0.85} />
          <Stop offset="0.55" stopColor={C.brand} stopOpacity={0.3} />
          <Stop offset="1" stopColor={C.brand} stopOpacity={0} />
        </RadialGradient>
        {/* Body: the brand itself, the widest of the three. */}
        <RadialGradient id="body" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={C.brand} stopOpacity={0.75} />
          <Stop offset="0.5" stopColor={C.brandSoft} stopOpacity={0.34} />
          <Stop offset="1" stopColor={C.brandSoft} stopOpacity={0} />
        </RadialGradient>
        {/* Shadow: the bottom of the ramp, trailing off to the right. */}
        <RadialGradient id="deep" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={C.brandGrad[1]} stopOpacity={0.55} />
          <Stop offset="1" stopColor={C.brandGrad[1]} stopOpacity={0} />
        </RadialGradient>
        {/* The dark vein through the middle of the smear — without it the three
            stops average into a flat wash instead of reading as glass. */}
        <RadialGradient id="vein" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={C.canvas} stopOpacity={0.92} />
          <Stop offset="1" stopColor={C.canvas} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <Ellipse cx={168} cy={104} rx={150} ry={62} fill="url(#body)" />
      <Ellipse cx={116} cy={78} rx={92} ry={44} fill="url(#hi)" />
      <Ellipse cx={214} cy={132} rx={116} ry={40} fill="url(#deep)" />
      <Ellipse cx={176} cy={112} rx={104} ry={26} fill="url(#vein)" />
    </Svg>
  );
}
