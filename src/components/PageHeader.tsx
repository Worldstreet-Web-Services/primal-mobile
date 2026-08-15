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
 * stays put whether or not the right slot is filled.
 */
export function PageHeader({
  title,
  onBack,
  right,
  style,
}: {
  title: string;
  /** Omit on a root screen — the back button disappears with it. */
  onBack?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();

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
          textAlign: "center",
          // Keeps the title on the row's own center line while the buttons
          // float over it — a flex row would push it off-center by their width.
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
