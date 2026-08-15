import { AppState } from "react-native";

// Gate for store-owned REST pollers. iOS pauses JS timers in the background,
// but Android keeps firing them — every backgrounded tick is radio and
// battery spent on a screen nobody is looking at. Tick bodies early-return
// on appIsActive(); stores whose data must be right the moment the user
// returns also take an onForeground catch-up load instead of waiting out
// the remainder of their interval.

export function appIsActive(): boolean {
  // "background" specifically, NOT "not active": iOS reports "inactive" for
  // the notification shade, Control Center, the app switcher and call rings
  // — the content is still on screen and pre-gate RN kept intervals firing
  // through all of those. Gating on !== "active" froze a live game's only
  // transport during a call ring (the ws gateway already drops the socket on
  // non-active states).
  return AppState.currentState !== "background";
}

/** Run cb on every background→foreground transition. Returns unsubscribe. */
export function onForeground(cb: () => void): () => void {
  let wasForeground = appIsActive();
  const sub = AppState.addEventListener("change", () => {
    const foreground = appIsActive();
    // Keyed off "background", so dismissing the iOS shade (inactive→active)
    // does not fire a spurious reload — ticks never stopped during it.
    if (foreground && !wasForeground) cb();
    wasForeground = foreground;
  });
  return () => sub.remove();
}
