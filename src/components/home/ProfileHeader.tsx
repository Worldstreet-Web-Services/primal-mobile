import { Image, type ImageSource } from "expo-image";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { cn } from "../../lib/cn";
import { useTokens } from "../../theme/tokens";
import { BellIcon } from "../icons";
import { CircleAction } from "../ui";

/**
 * Round portrait with a brand ring. Falls back to the initial when there is no
 * photo, so the row never collapses while an avatar is still loading or was
 * never set.
 */
export function Avatar({
  source,
  initial,
  size = 38,
  ringClassName = "border-brand-soft",
}: {
  source?: ImageSource | number;
  /** Shown when `source` is missing — one character, uppercased. */
  initial?: string;
  size?: number;
  /** The 1.5pt ring around the portrait. */
  ringClassName?: string;
}) {
  return (
    <View
      className={cn(
        "items-center justify-center overflow-hidden border-[1.5px] bg-canvas-inset",
        ringClassName,
      )}
      // Size drives the radius, so both stay numbers.
      style={{ width: size, height: size, borderRadius: size / 2 }}
    >
      {source ? (
        <Image
          source={source}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Text
          className="font-display-bold text-silver"
          style={{
            fontSize: size * 0.42,
          }}
        >
          {(initial ?? "?").slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

/**
 * Who you are, at the top of a scroll: portrait, name, and the one-line tagline
 * under it, with a chrome action holding the right edge.
 *
 * `right` replaces the default bell outright — pass it when a surface needs a
 * different action there rather than stacking a second one beside it.
 */
export function ProfileHeader({
  name,
  tagline,
  avatar,
  unread = false,
  onPress,
  onNotifications,
  right,
  style,
}: {
  name: string;
  tagline?: string;
  avatar?: ImageSource | number;
  unread?: boolean;
  /** Tap on the identity block — usually opens the profile. */
  onPress?: () => void;
  onNotifications?: () => void;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const tokens = useTokens();
  return (
    <View className="flex-row items-center gap-[10px]" style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? `${name}, open profile` : undefined}
        className="flex-1 flex-row items-center gap-[10px]"
      >
        <Avatar source={avatar} initial={name} />
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="font-display-bold text-[17px] tracking-[0.3px] text-text"
          >
            {name.toUpperCase()}
          </Text>
          {tagline ? (
            <Text
              numberOfLines={1}
              className="font-body text-[11px] tracking-[0.8px] text-sub mt-[1px]"
            >
              {tagline.toUpperCase()}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {right ?? (
        <CircleAction
          onPress={onNotifications}
          badge={unread}
          accessibilityLabel={
            unread ? "Notifications, unread" : "Notifications"
          }
        >
          <BellIcon size={19} color={tokens.text} />
        </CircleAction>
      )}
    </View>
  );
}
