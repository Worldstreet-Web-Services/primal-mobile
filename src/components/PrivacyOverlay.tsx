import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, StyleSheet } from "react-native";

import { Splash } from "./Splash";

/** How long the cover takes to clear once the app is frontmost again. */
const FADE_OUT = 260;

/**
 * Hides the app's contents whenever it stops being frontmost, so balances and
 * account numbers never end up in the iOS app-switcher snapshot (which the
 * system takes on the way out) or on screen while a system sheet is up.
 *
 * It mounts the brand splash rather than a blur: an opaque ground can't be
 * reconstructed, and it reads as a deliberate lock screen instead of a glitch.
 * Static, because the animation would replay on every glance at the switcher.
 *
 * The transition is deliberately asymmetric — it covers on the same frame and
 * only fades on the way out. A fade in would hand the snapshot a half-
 * transparent screen, which is the one thing this component exists to prevent.
 *
 * iOS fires `inactive` before `background`, and the snapshot is taken in that
 * window — so anything short of covering on `inactive` is too late. The cost is
 * that the overlay also appears for the transient inactives: Control Centre,
 * the notification pull-down, an incoming call, a permission or share sheet.
 * That's the accepted trade — a flash of the logo, never a flash of the money.
 */
export function PrivacyOverlay() {
  const [mounted, setMounted] = useState(
    () => AppState.currentState !== "active",
  );
  const opacity = useRef(
    new Animated.Value(AppState.currentState !== "active" ? 1 : 0),
  ).current;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        // Stop first: a fade-out still in flight would otherwise finish and
        // hide the cover moments after we asked for it.
        opacity.stopAnimation();
        opacity.setValue(1);
        setMounted(true);
        return;
      }

      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        // `finished` is false when a new background interrupted the fade —
        // unmounting then would tear the cover away mid-snapshot.
        if (finished) setMounted(false);
      });
    });
    return () => sub.remove();
  }, [opacity]);

  if (!mounted) return null;

  return (
    // Never interactive: the app isn't frontmost while it's opaque, and during
    // the fade this keeps it from swallowing the user's first tap back in.
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <Splash animated={false} />
    </Animated.View>
  );
}
