import { Image } from "expo-image";
import { View, useWindowDimensions, type ViewStyle } from "react-native";

const SOURCE = require("../../assets/images/background_float.png");

/** Authored at 3x against a 393pt screen — width drives, height follows. */
const INTRINSIC = { width: 1179, height: 1905 };
const ASPECT = INTRINSIC.width / INTRINSIC.height;

/**
 * The drifting metric pills (ROI, APY, Profit) and their faint orbit rings —
 * the ambient layer the onboarding screens sit the mark on.
 *
 * Pinned to the top edge at full screen width, which is the ratio it was drawn
 * at, so the pills land where the artwork intends and the rings fall away below
 * the fold. It never takes touches.
 *
 * `opacity` is the dial: full strength where the backdrop is the subject, lower
 * where type has to read over it.
 */
export function FloatingBackdrop({
  opacity = 1,
  top = 0,
  style,
}: {
  /** 0–1 presence. Drop it toward 0.3 when content sits on top. */
  opacity?: number;
  /** Offset from the top edge — negative to push the pills off-screen. */
  top?: number;
  style?: ViewStyle;
}) {
  const { width } = useWindowDimensions();

  return (
    <View
      pointerEvents="none"
      className="absolute left-[0px]"
      style={[{ top, width, opacity }, style]}
    >
      <Image
        source={SOURCE}
        contentFit="contain"
        style={{ width, height: width / ASPECT }}
      />
    </View>
  );
}
