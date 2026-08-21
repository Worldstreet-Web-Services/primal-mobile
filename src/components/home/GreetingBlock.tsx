import { Text, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
import { BellIcon } from "../icons";
import { CircleAction } from "../ui";

/**
 * The top of the page: the time-of-day greeting over the member's first name,
 * with the notifications control holding the right edge.
 *
 * The greeting is the eyebrow and the name carries the block — the inverse
 * (a 32pt greeting over an 18pt name) is what used to wrap "Good Afternoon,"
 * onto two lines and double the block's height.
 */
export function GreetingBlock({
  greeting,
  name,
  unread = false,
  onNotifications,
  onPressName,
  style,
}: {
  greeting: string;
  /** First name only — this block has room for one line. */
  name: string;
  unread?: boolean;
  onNotifications?: () => void;
  onPressName?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, style]}
    >
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.displayBold,
            fontSize: 20,
            lineHeight: 24,
            letterSpacing: 0.1,
            color: C.sub,
          }}
        >
          {greeting}
        </Text>
        <Text
          numberOfLines={1}
          onPress={onPressName}
          suppressHighlighting
          style={{
            fontFamily: F.displayBold,
            fontSize: 26,
            lineHeight: 31,
            letterSpacing: 0.1,
            color: C.text,
          }}
        >
          {name}
        </Text>
      </View>

      <CircleAction
        onPress={onNotifications}
        badge={unread}
        accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
      >
        <BellIcon size={19} color={C.text} />
      </CircleAction>
    </View>
  );
}
