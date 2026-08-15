import { Image, type ImageSource } from "expo-image";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
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
  ring = C.brandSoft,
}: {
  source?: ImageSource | number;
  /** Shown when `source` is missing — one character, uppercased. */
  initial?: string;
  size?: number;
  ring?: string;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: ring,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.inset,
      }}
    >
      {source ? (
        <Image
          source={source}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <Text
          style={{
            fontFamily: F.displayBold,
            fontSize: size * 0.42,
            color: C.silver,
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
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: 10 },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={onPress ? `${name}, open profile` : undefined}
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Avatar source={avatar} initial={name} />
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: F.displayBold,
              fontSize: 17,
              letterSpacing: 0.3,
              color: C.text,
            }}
          >
            {name.toUpperCase()}
          </Text>
          {tagline ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: F.body,
                fontSize: 11,
                letterSpacing: 0.8,
                color: C.sub,
                marginTop: 1,
              }}
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
          accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
        >
          <BellIcon size={19} color={C.text} />
        </CircleAction>
      )}
    </View>
  );
}
