import { colorScheme, useColorScheme } from "nativewind";

/**
 * The palette in TypeScript — a MIRROR of `src/global.css`, not a second source
 * of truth.
 *
 * Almost nothing should import this. Colour belongs in a `className`, where the
 * variables in global.css already resolve per theme. What is left here is the
 * set of places a class genuinely cannot reach:
 *
 *   - `LinearGradient` / `expo-blur` props — `colors`, `tint`, `intensity` are
 *     props, not styles, so no utility applies to them;
 *   - SVG `fill` / `stroke` on `react-native-svg` primitives;
 *   - `shadowColor`, which RN takes as a value and NativeWind does not map;
 *   - values fed to Reanimated / `Animated.Value` interpolation, which need a
 *     concrete colour at the JS end rather than a class.
 *
 * Anything else reading a colour from here is a call site not yet migrated.
 *
 * KEEPING THE TWO IN STEP: every key below has a `--kebab-case` twin in
 * global.css and the values must match. They are the same palette in two
 * syntaxes; change one, change both. The CSS is what the app paints from for
 * every className, so drift here shows up only in gradients and SVG — which is
 * exactly the failure that hid the gold palette for a week when this file and
 * `tailwind.config.js` disagreed.
 */
export interface Palette {
  canvas: string;
  card: string;
  border: string;
  borderStrong: string;
  hairline: string;

  text: string;
  sub: string;
  dim: string;
  figureTail: string;
  placeholder: string;
  silver: string;
  accent: string;

  up: string;
  upBg: string;
  down: string;
  live: string;
  amber: string;
  highlight: string;
  highlightInk: string;
  ink: string;
  sheet: string;
  key: string;

  /** Four raked stops. Always drawn on the diagonal — see `METAL_ANGLE`. */
  metal: [string, string, string, string];
  metalShine: string;
  metalInk: string;

  brand: string;
  brandInk: string;
  brandSoft: string;
  /** Lit face to shadow, for a raked fill on the mark and the primary CTA. */
  brandGrad: [string, string];
  brandSoftInk: string;
  brandGlow: string;

  green: string;
  greenInk: string;
  greenGlow: string;

  raised: string;
  inset: string;

  glass: string;
  glassTint: string;
  glassEdge: string;
}

/** Stop positions for `metal`; keep them together or the sheen moves. */
export const metalStops: [number, number, number, number] = [0, 0.38, 0.62, 1];

const DARK: Palette = {
  canvas: "#000000",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.28)",
  hairline: "rgba(255,255,255,0.08)",

  text: "#F2F4F6",
  sub: "#C0C6CE",
  dim: "#989EA7",
  figureTail: "#7A808A",
  placeholder: "rgba(255,255,255,0.20)",
  silver: "#C0C6CE",
  accent: "#d4d4d8",

  up: "#7CE7B0",
  upBg: "rgba(124,231,176,0.12)",
  down: "#f6a5a5",
  live: "#DCF3CC",
  amber: "#F5B83D",
  highlight: "#D9F24B",
  highlightInk: "#12180A",
  ink: "#0a0a0a",
  sheet: "#0A0A0A",
  key: "#161617",

  metal: ["#F4F6F8", "#CBD0D6", "#EAEDF0", "#A6ACB4"],
  metalShine: "rgba(255,255,255,0.85)",
  metalInk: "#0B0C0E",

  brand: "#83BE60",
  brandInk: "#0A1405",
  brandSoft: "#74AC55",
  brandGrad: ["#9BD177", "#5E9440"],
  brandSoftInk: "#081103",
  brandGlow: "rgba(131,190,96,0.14)",

  green: "#65BB64",
  greenInk: "#06140A",
  greenGlow: "rgba(101,187,100,0.14)",

  raised: "#14141495",
  inset: "#1E1E20",

  glass: "rgba(18,18,18,0.72)",
  glassTint: "rgba(0,0,0,0.5)",
  glassEdge: "rgba(0,0,0,0.6)",
};

const LIGHT: Palette = {
  canvas: "#F4F5F7",
  card: "rgba(0,0,0,0.035)",
  border: "rgba(0,0,0,0.12)",
  borderStrong: "rgba(0,0,0,0.26)",
  hairline: "rgba(0,0,0,0.08)",

  text: "#0B0D10",
  sub: "#4E555E",
  dim: "#656C75",
  figureTail: "#868D95",
  placeholder: "rgba(0,0,0,0.30)",
  silver: "#4E555E",
  accent: "#52525B",

  up: "#0B7A4C",
  upBg: "rgba(11,122,76,0.10)",
  down: "#C0272D",
  live: "#3E7D1F",
  amber: "#8A5D00",
  highlight: "#AFC42A",
  highlightInk: "#12180A",
  ink: "#0a0a0a",
  sheet: "#FFFFFF",
  key: "#E9EBEE",

  // Graphite rather than silver: a brushed bright face has no presence on a
  // light ground, so the light-mode object is a dark milled face lit from the
  // same angle — and its ink flips to white with it.
  metal: ["#5A6068", "#31363D", "#4A5058", "#20242A"],
  metalShine: "rgba(255,255,255,0.35)",
  metalInk: "#FFFFFF",

  brand: "#3F7522",
  brandInk: "#FFFFFF",
  brandSoft: "#34611C",
  brandGrad: ["#4F9130", "#2C5417"],
  brandSoftInk: "#FFFFFF",
  brandGlow: "rgba(63,117,34,0.12)",

  green: "#2F7F2E",
  greenInk: "#FFFFFF",
  greenGlow: "rgba(47,127,46,0.12)",

  raised: "rgba(255,255,255,0.96)",
  inset: "#E8EAED",

  glass: "rgba(255,255,255,0.78)",
  glassTint: "rgba(255,255,255,0.5)",
  glassEdge: "rgba(244,245,247,0.75)",
};

export const PALETTES = { light: LIGHT, dark: DARK } as const;

/**
 * The active palette, for components.
 *
 * Prefer this over `C` anywhere the value is read during render: it subscribes
 * to the colour scheme, so the component repaints when the theme changes. `C`
 * reads the right value but does not re-render the reader.
 */
export function useTokens(): Palette {
  const { colorScheme: scheme } = useColorScheme();
  return scheme === "light" ? LIGHT : DARK;
}

/**
 * The active palette, for everywhere a hook cannot go — module scope, event
 * handlers, helpers called outside a component.
 *
 * Resolved on every property read rather than captured at import, so it is
 * never stale. What it does NOT do is subscribe: a component reading `C` during
 * render paints the correct colour for the theme in force at that moment, but
 * will not repaint on its own when the theme changes. Inside a component, reach
 * for `useTokens()`.
 */
export const C: Palette = new Proxy({} as Palette, {
  get(_target, key) {
    const active = colorScheme.get() === "light" ? LIGHT : DARK;
    return active[key as keyof Palette];
  },
  // Without these a spread or `Object.keys` would see an empty object.
  ownKeys: () => Reflect.ownKeys(DARK),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/**
 * Font families, by ROLE.
 *
 * The same seven roles `tailwind.config.js` exposes as `font-display`,
 * `font-body`, `font-mono` and friends — prefer those classes. This object
 * serves the same escape hatches the palette above does: `Animated.Text` style
 * objects, and anywhere a family is computed rather than written.
 *
 * Urbanist throughout, 2026-08-16 — one family, five static instances (RN
 * resolves `fontFamily` to a concrete face, so weight axes on a variable TTF
 * never land on Android). `mono` is Urbanist too: it keeps the name for the
 * ROLE it plays — figures, account numbers, tracked labels — not the face.
 * Urbanist has no monospace cut, so the column alignment those placements need
 * comes from `fontVariant: ["tabular-nums"]` on the `Mono` component.
 *
 * SWAPPING IN INTER (pending — the client is supplying the files, 2026-08-21):
 * drop the five `Inter-*.ttf` files into `assets/fonts/`, add them to the
 * `useFonts` map in `src/app/_layout.tsx`, then change the five values below
 * AND the `fontFamily` block in `tailwind.config.js`. Do NOT rename the keys —
 * ~40 files import `F.display` and friends by role, and the roles do not change
 * with the family. Expect a visual re-check afterwards: Inter runs wider than
 * Urbanist at the same point size and its default line box is taller.
 */
export const F = {
  display: "Urbanist-Bold",
  displayBold: "Urbanist-ExtraBold",
  body: "Urbanist-Regular",
  bodyMedium: "Urbanist-Medium",
  bodySemibold: "Urbanist-SemiBold",
  mono: "Urbanist-Medium",
  monoSemibold: "Urbanist-SemiBold",
};
