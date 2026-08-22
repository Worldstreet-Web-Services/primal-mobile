import { Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F } from "../theme/tokens";
import { BackChevron, CircleAction } from "./ui";

/**
 * Static header for a pushed page: circular back at the left edge, title
 * centered on the row. Unlike `NavHeader` it does not float or frost — content
 * starts underneath it rather than scrolling behind it, so a page using this
 * needs no head-space measurement.
 *
 * The title is centered against the row, not against what's left of it, so it
 * stays put whether or not the right slot is filled — unless `align` is
 * `"left"`, where it sits beside the back button instead.
 */
export function PageHeader({
  title,
  onBack,
  right,
  align = "center",
  style,
}: {
  title: string;
  /** Omit on a root screen — the back button disappears with it. */
  onBack?: () => void;
  right?: React.ReactNode;
  /**
   * Where the title sits on the row. `center` is the app's pushed-page default;
   * `left` puts it next to the back button, for a page whose subject is the
   * thing under the header rather than the section it came from.
   */
  align?: "center" | "left";
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const left = align === "left";

  return (
    <View
      style={[
        {
          paddingTop: insets.top + 6,
          paddingHorizontal: 14,
          paddingBottom: 20,
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          fontFamily: F.displayBold,
          fontSize: 17,
          letterSpacing: 0.2,
          color: C.text,
          textAlign: left ? "left" : "center",
          // Keeps the title on the row's own center line while the buttons
          // float over it — a flex row would push it off-center by their width.
          // Left-aligned it does the same job from the other end: the title
          // starts clear of the back button and stops clear of the action.
          marginHorizontal: 48,
        }}
      >
        {title}
      </Text>

      {onBack ? (
        <View style={{ position: "absolute", left: 14, top: insets.top }}>
          <CircleAction onPress={onBack} size={36} accessibilityLabel="Go back">
            <BackChevron color={C.text} />
          </CircleAction>
        </View>
      ) : null}

      {right ? (
        <View style={{ position: "absolute", right: 14, top: insets.top + 6 }}>
          {right}
        </View>
      ) : null}
    </View>
  );
}
