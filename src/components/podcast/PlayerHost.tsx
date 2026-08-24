import { router, useSegments } from "expo-router";
import { useEffect } from "react";
import {
  BackHandler,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayerStore } from "@/store/player";
import { MINI_HEIGHT, MiniPlayer } from "./MiniPlayer";
import { NowPlaying } from "./NowPlaying";

/**
 * Height of the platform's own tab bar, above the safe-area inset it already
 * pads itself with. `(tabs)` uses `NativeTabs`, so there is no
 * `useBottomTabBarHeight()` to ask — the bar is a platform view, not a JS
 * navigator, and these are its two documented resting heights.
 */
const TAB_BAR_H = Platform.select({ ios: 49, android: 80, default: 56 })!;
/** Breathing room between the bar and whatever it sits above. */
const MINI_MARGIN = 8;
const MINI_SIDE = 12;

const TIMING = {
  duration: 340,
  // Long tail out of a fast start — the same curve `GlassDrawer` arrives on.
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

/** Past this fraction of the screen, letting go minimises instead of snapping back. */
const DISMISS_TRAVEL = 0.16;
const DISMISS_VELOCITY = 900;

/**
 * The auth surface. Nothing floats over it — mirrors `OPEN_WHILE_LOCKED` in
 * `lib/auth/LockGate`, for the same reason: those routes are the app before you
 * are in it, and chrome from inside the app has no business on them.
 */
const NO_CHROME = new Set([
  "",
  "unlock",
  "welcome",
  "signin",
  "pin",
  "passkey",
  "email",
  "continue",
]);

/**
 * Mounts the podcast player above every route.
 *
 * Playback has to outlive the screen that started it, so the player is chrome
 * on the root layout rather than a screen of its own: minimising leaves the
 * transport running and drops a bar over whatever you navigate to next, which
 * a pushed route could not do.
 *
 * One shared value drives both halves. `p` is 0 when the bar is docked and 1
 * when the sheet is up; the sheet's travel and the bar's fade are both read off
 * it, so a drag moves the two together instead of animating one and then the
 * other. The drag writes `p` directly — it is a pan on the UI thread, and
 * routing it through React state would give the sheet a frame of lag under the
 * finger.
 */
export function PlayerHost() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const segments = useSegments();

  const episode = usePlayerStore((s) => s.episode);
  const expanded = usePlayerStore((s) => s.expanded);
  const minimize = usePlayerStore((s) => s.minimize);

  const p = useSharedValue(0);

  const drag = Gesture.Pan()
    // Downward only, and only past a real drag — a tap or a horizontal swipe
    // on the artwork must not start dismissing the sheet.
    .activeOffsetY(12)
    .failOffsetY(-12)
    .onUpdate((e) => {
      p.value = Math.min(Math.max(1 - e.translationY / height, 0), 1);
    })
    .onEnd((e) => {
      const dismissed =
        e.translationY > height * DISMISS_TRAVEL ||
        e.velocityY > DISMISS_VELOCITY;
      p.value = withTiming(dismissed ? 0 : 1, TIMING);
      if (dismissed) runOnJS(minimize)();
    });

  // Kept ahead of the effects below: both this and the sync effect write `p`,
  // and the compiler's rules only allow that when the writes are ordered.
  useEffect(() => {
    p.value = withTiming(expanded ? 1 : 0, TIMING);
  }, [expanded, p]);

  // Android back closes the sheet before it pops a route — the sheet is what is
  // in front of the user, so it is what back has to act on.
  useEffect(() => {
    if (!expanded) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      minimize();
      return true;
    });
    return () => sub.remove();
  }, [expanded, minimize]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - p.value) * height }],
  }));

  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.5], [1, 0], "clamp"),
    // Travels a little with the fade, so the bar reads as the sheet's own
    // resting state rather than a second thing that happens to dissolve.
    transform: [{ translateY: interpolate(p.value, [0, 1], [0, 24], "clamp") }],
  }));

  const head: string = segments.length > 0 ? segments[0] : "";
  const inTabs = head === "(tabs)";

  if (!episode || NO_CHROME.has(head)) return null;

  return (
    <>
      <Animated.View
        // The bar clears the tab bar where there is one, and only the home
        // indicator where there is not.
        style={[
          {
            position: "absolute",
            left: MINI_SIDE,
            right: MINI_SIDE,
            bottom: (inTabs ? TAB_BAR_H : 0) + insets.bottom + MINI_MARGIN,
          },
          miniStyle,
        ]}
        pointerEvents={expanded ? "none" : "box-none"}
      >
        <MiniPlayer />
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, sheetStyle]}
        // Off-screen it still covers the app's whole frame, so it has to stop
        // taking touches or every tap behind it would land here.
        pointerEvents={expanded ? "auto" : "none"}
      >
        <NowPlaying
          dragGesture={drag}
          onSeeAll={() => {
            minimize();
            router.push("/podcast");
          }}
        />
      </Animated.View>
    </>
  );
}

/**
 * Bottom clearance a scrolling screen owes the docked bar — zero when nothing
 * is playing, so a screen picks up the room only while there is a bar to clear
 * and does not carry a permanent gap for chrome that usually is not there.
 *
 * Any screen whose content runs to the bottom of the viewport should add this
 * to its own bottom padding.
 */
export function useMiniPlayerClearance(): number {
  return usePlayerStore((s) => (s.episode ? MINI_HEIGHT + MINI_MARGIN * 2 : 0));
}
