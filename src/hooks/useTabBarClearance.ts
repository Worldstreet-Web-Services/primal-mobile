/**
 * How much bottom padding a tab screen owes the tab bar.
 *
 * The bar under `(tabs)` is NATIVE — `expo-router/unstable-native-tabs` renders
 * a real `UITabBar` / Material `NavigationBar` rather than the JS row this app
 * used to draw. That is the whole reason this hook exists: a native bar is not
 * part of the React tree, so it contributes nothing to layout and a `ScrollView`
 * happily runs its last line underneath it. `TAB_BAR_CLEARANCE` in
 * `components/home/TabBar.tsx` measures the OLD hand-drawn bar and is wrong for
 * this one.
 *
 * The safe-area inset is ADDED rather than assumed: on a notched handset the
 * bar sits on top of the home indicator and occupies both, so the occluded
 * strip is the bar's own height plus that inset.
 *
 * Any screen inside `(tabs)` whose content runs to the bottom of the viewport
 * should add this to its bottom padding — and add the mini-player clearance on
 * top of it when a podcast can be docked there.
 */

import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The bar itself, without the safe area.
 *
 * 49 is UIKit's compact tab bar; Material 3's `NavigationBar` is 80dp, and the
 * Android bar draws its own label row inside that. Web has no native bar at all
 * and falls back to something bar-shaped rather than to zero.
 */
const BAR_HEIGHT = Platform.select({ ios: 49, android: 80, default: 56 })!;

/**
 * `extra` is breathing room, not clearance: 24 keeps the last line of a page
 * clear of the bar instead of tucked against it. Pass a larger number on a
 * screen that ends in a control, where touching the bar is worse than looking
 * cramped.
 */
export function useTabBarClearance(extra = 24): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + insets.bottom + extra;
}
