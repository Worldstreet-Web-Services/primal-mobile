import { cssInterop } from "nativewind";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Teach NativeWind about components it does not ship support for.
 *
 * `cssInterop` is only applied to React Native's own components out of the box.
 * Anything from a third-party package takes `style` and would silently ignore a
 * `className` — silently being the problem, since nothing errors and the screen
 * just renders unstyled.
 *
 * Imported for its side effect from `src/app/_layout.tsx`, before any screen
 * mounts. Register a component here the first time you want to hand it classes.
 */
cssInterop(SafeAreaView, { className: "style" });
