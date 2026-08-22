import { type ImageSource } from "expo-image";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { C, F } from "../../theme/tokens";
import { BellIcon, PersonIcon } from "../icons";
import { CircleAction } from "../ui";
import { Avatar } from "./ProfileHeader";

/**
 * The white face on the header's two round controls.
 *
 * Both the portrait and the bell are solid white discs in the reference, and
 * that is the only bright thing above the fold — on a true-black canvas they
 * are what stop the top of the page reading as empty. Their glyphs are inked
 * `C.ink` for the same reason a metal pill inks its label dark: the disc is the
 * lit surface, so anything on it has to be the shadow.
 */
const FACE = { backgroundColor: C.text, borderWidth: 0 } as const;

/**
 * The top of the page: the member's portrait, the time-of-day greeting over
 * their first name, and the notifications control holding the right edge.
 *
 * The greeting is the eyebrow and the name carries the block — the inverse
 * (a 32pt greeting over an 18pt name) is what used to wrap "Good Afternoon,"
 * onto two lines and double the block's height.
 */
export function GreetingBlock({
  greeting,
  name,
  avatar,
  initial,
  unread = false,
  onNotifications,
  onProfilePress,
  style,
}: {
  greeting: string;
  /** First name only — this block has room for one line. */
  name: string;
  /** The portrait. Falls back to a glyph, so the row never collapses. */
  avatar?: ImageSource | number;
  /** Shown on the disc when there is no portrait AND no glyph is wanted. */
  initial?: string;
  unread?: boolean;
  onNotifications?: () => void;
  onProfilePress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          paddingHorizontal: 18,
          paddingBottom: 10,
        },
        style,
      ]}
    >
      {avatar || initial ? (
        <Pressable onPress={onProfilePress}>
          <Avatar source={avatar} initial={initial} size={46} ring={C.text} />
        </Pressable>
      ) : (
        // PLACEHOLDER PORTRAIT. Not an empty ring and not a "?" — a person
        // glyph on the white face, which is what the reference shows and what
        // reads as "no photo yet" rather than as a failed load. Pass `avatar`
        // and this disappears.
        <Pressable
          onPress={onProfilePress}
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: "center",
            justifyContent: "center",
            ...FACE,
          }}
        >
          <PersonIcon size={26} color={C.ink} filled />
        </Pressable>
      )}

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.body,
            fontSize: 17,
            lineHeight: 22,
            letterSpacing: 0.1,
            color: C.sub,
          }}
        >
          {greeting}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.displayBold,
            fontSize: 25,
            lineHeight: 30,
            letterSpacing: -0.2,
            color: C.text,
          }}
        >
          {name}
        </Text>
      </View>

      <CircleAction
        onPress={onNotifications}
        size={46}
        badge={unread}
        badgeRing={C.text}
        style={FACE}
        accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
      >
        <BellIcon size={21} color={C.ink} />
      </CircleAction>
    </View>
  );
}
