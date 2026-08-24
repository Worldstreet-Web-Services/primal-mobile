import { type ImageSource } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import { useTokens } from "@/theme/tokens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellIcon, PersonIcon } from "../icons";
import { CircleAction } from "../ui";
import { Avatar } from "./ProfileHeader";

/**
 * The face on the header's two round controls.
 *
 * Both the portrait and the bell are solid discs of the TEXT colour in the
 * reference, and that is the only bright thing above the fold — on a true-black
 * canvas they are what stop the top of the page reading as empty. Their glyphs
 * are inked in the CANVAS colour for the same reason a metal pill inks its
 * label dark: the disc is the lit surface, so anything on it has to be the
 * shadow. Stating the pair as two tokens rather than as white and black is what
 * makes them swap correctly when the theme does.
 */
const FACE = "border-0 bg-text";

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
}) {
  const insets = useSafeAreaInsets();
  // Both glyphs are SVG `color` props, which no class reaches. `useTokens`
  // subscribes, so they repaint when the theme changes.
  const tokens = useTokens();
  return (
    <View
      className="flex-row items-center gap-4 px-5 pb-3"
      style={{ paddingTop: insets.top + 6 }}
    >
      {avatar || initial ? (
        <Pressable onPress={onProfilePress}>
          <Avatar
            source={avatar}
            initial={initial}
            size={46}
            ringClassName="border-text"
          />
        </Pressable>
      ) : (
        // PLACEHOLDER PORTRAIT. Not an empty ring and not a "?" — a person
        // glyph on the white face, which is what the reference shows and what
        // reads as "no photo yet" rather than as a failed load. Pass `avatar`
        // and this disappears.
        <Pressable
          onPress={onProfilePress}
          className={cn(
            "h-[46px] w-[46px] items-center justify-center rounded-full",
            FACE,
          )}
        >
          <PersonIcon size={26} color={tokens.canvas} filled />
        </Pressable>
      )}

      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="font-body text-[17px] leading-[22px] tracking-[0.1px] text-sub"
        >
          {greeting}
        </Text>
        <Text
          numberOfLines={1}
          className="font-display-bold text-[25px] leading-[30px] tracking-[-0.2px] text-text"
        >
          {name}
        </Text>
      </View>

      <CircleAction
        onPress={onNotifications}
        size={46}
        badge={unread}
        badgeRingClassName="border-text"
        className={FACE}
        accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
      >
        <BellIcon size={21} color={tokens.canvas} />
      </CircleAction>
    </View>
  );
}
