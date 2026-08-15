import { Pressable, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { Body, Display } from "../ui";

/** Section title with its optional "View All" escape hatch on the right. */
export function SectionHeader({
  title,
  actionLabel = "View All",
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  /** Omit and the action disappears — the title still holds the row. */
  onAction?: () => void;
  style?: { marginTop?: number };
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        style,
      ]}
    >
      <Display size={17}>{title}</Display>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Body
            size={12.5}
            color={C.brand}
            style={{ fontFamily: F.bodyMedium }}
          >
            {actionLabel}
          </Body>
        </Pressable>
      ) : null}
    </View>
  );
}
