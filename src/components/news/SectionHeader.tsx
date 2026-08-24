import { Pressable, View } from "react-native";

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
    <View className="flex-row items-center justify-between" style={style}>
      <Display className="text-[17px] leading-[17.85px]">{title}</Display>
      {onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Body className="text-[12.5px] text-brand font-body-medium">
            {actionLabel}
          </Body>
        </Pressable>
      ) : null}
    </View>
  );
}
