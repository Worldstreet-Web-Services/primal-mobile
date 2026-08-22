# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Styling: NativeWind `className` first

This project uses NativeWind v4. **Every component you generate or edit styles with
Tailwind `className` strings.** `StyleSheet.create` and inline `style={{ ... }}` are the
exception, not the default — reach for them only when `className` genuinely cannot express
the style.

- Use the design tokens defined in `tailwind.config.js` (`brand`, `canvas`, `silver`,
  `up`/`down`, `highlight`, and the `font-display` / `font-body` / `font-mono` families)
  rather than raw hex values or arbitrary values like `text-[#83BE60]`. `C` in
  `src/theme/tokens.ts` mirrors these — keep the two in step.
- Conditional styling goes in the class string (template literals or a small ternary),
  not a merged style object.
- Don't create a `StyleSheet` block for something a class already covers (padding, margin,
  flex, colors, radius, borders, typography, opacity, gap, absolute positioning).

`style` is acceptable only for:

- Values NativeWind can't express — Reanimated `useAnimatedStyle`, transforms driven by
  `Animated.Value`, or measured/computed numbers from layout or safe-area insets.
- Props that aren't styles at all (`contentContainerStyle` on a list still prefers
  `contentContainerClassName` when the component supports it; gradient `colors`, blur
  `intensity`, and shadow config on native stay props).
- Platform APIs with no class equivalent (e.g. native shadow/elevation tuning,
  `expo-linear-gradient` / `expo-blur` configuration).

When you must use `style`, keep it to the one property that needs it and leave the rest of
the styling in `className`.
