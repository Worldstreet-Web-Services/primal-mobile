import { LinearGradient } from "expo-linear-gradient";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C, F } from "../../theme/tokens";
import { BellIcon } from "../icons";
import { GlassSurface } from "../ui";

export type NavHeaderDirection = "row" | "column";

/** Soft falloff under the glass so the blur doesn't end on a hard line. */
const FADE_HEIGHT = 34;

/**
 * App chrome: wordmark + notification bell on translucent glass that covers
 * the whole top region — status bar included — with content scrolling
 * underneath it. Kept dumb: the badge and the handler come from whoever
 * mounts it.
 *
 * It overlays its parent, so mount it *after* the scroll view (siblings paint
 * in order) and feed `onHeightChange` into `Screen`'s `top` so the first card
 * doesn't start underneath the glass.
 *
 * `direction` lays the wordmark and tagline on one baseline (default) or
 * stacks them into a masthead; the bell holds the right edge either way.
 */
export function NavHeader({
  wordmark = "PRIMAL",
  tagline = "ECOSYSTEM",
  unread = false,
  direction = "row",
  onNotifications,
  onHeightChange,
}: {
  wordmark?: string;
  tagline?: string;
  unread?: boolean;
  direction?: NavHeaderDirection;
  onNotifications?: () => void;
  /** Measured height of the glass block, excluding the decorative fade. */
  onHeightChange?: (height: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const column = direction === "column";

  const onLayout = (e: LayoutChangeEvent) =>
    onHeightChange?.(e.nativeEvent.layout.height);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, right: 0 }}
    >
      <View
        onLayout={onLayout}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingLeft: 20,
          paddingRight: 20,
          // Glass runs up behind the status bar rather than starting below it.
          paddingTop: insets.top + 10,
          // Percentages resolve against the parent's width in Yoga, so this is
          // ~5% of the screen — the breathing room a stacked masthead needs.
          paddingBottom: column ? "5%" : 10,
        }}
      >
        <GlassSurface bordered={false} />

        {/* Row: the two type sizes share a baseline. Column: they stack. */}
        <View
          style={
            column
              ? { alignItems: "flex-start", gap: 6 }
              : { flexDirection: "row", alignItems: "baseline", gap: 10 }
          }
        >
          <Text
            style={{
              fontFamily: F.displayBold,
              fontSize: 25,
              color: C.text,
              letterSpacing: -0.4,
            }}
          >
            {wordmark}
          </Text>
          {tagline ? (
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: 2.6,
                color: C.dim,
              }}
            >
              {tagline}
            </Text>
          ) : null}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={onNotifications}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={unread ? "Notifications, unread" : "Notifications"}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: C.leaf,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BellIcon size={19} color={C.leafInk} />
          {unread ? (
            <View
              style={{
                position: "absolute",
                top: 3,
                right: 4,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: C.amber,
                borderWidth: 1.5,
                borderColor: C.leaf,
              }}
            />
          ) : null}
        </Pressable>
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={[C.glassEdge, "transparent"]}
        style={{ height: FADE_HEIGHT }}
      />
    </View>
  );
}
