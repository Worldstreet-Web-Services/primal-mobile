import type { ViewStyle } from "react-native";
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
  /** Specular top edge of a raised surface. Empty in light — see global.css. */
  shine: string;
  /** Cast shadow under a raised surface. Empty in DARK — the mirror of `shine`. */
  lift: string;

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
  /** Glyph on an amber fill. Flips with the theme — see global.css. */
  amberInk: string;
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
  /** Held-pill face: brand pushed UP into a lit green. */
  brandPressFace: string;
  /** Held-pill label and rim: brand pushed DOWN, 7.65:1 on the face above. */
  brandPressInk: string;
  /** The halo thrown outside a held pill's rim. Carries its own alpha. */
  brandPressGlow: string;

  green: string;
  greenInk: string;
  greenGlow: string;

  raised: string;
  inset: string;

  glass: string;
  glassTint: string;
  glassEdge: string;
  /**
   * Bare `"R,G,B"` — `GlassSurface` composes a caller-supplied alpha onto
   * these, so they cannot carry one of their own.
   */
  glassTintRgb: string;
  glassFillRgb: string;
}

/** Stop positions for `metal`; keep them together or the sheen moves. */
export const metalStops: [number, number, number, number] = [0, 0.38, 0.62, 1];

const DARK: Palette = {
  canvas: "#000000",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.28)",
  hairline: "rgba(255,255,255,0.08)",
  shine: "rgba(255,255,255,0.28)",
  lift: "rgba(0,0,0,0)",

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
  amberInk: "#120C00",
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
  brandPressFace: "#C6E3AC",
  brandPressInk: "#24460F",
  brandPressGlow: "rgba(131,190,96,0.38)",

  green: "#65BB64",
  greenInk: "#06140A",
  greenGlow: "rgba(101,187,100,0.14)",

  raised: "#14141495",
  inset: "#1E1E20",

  glass: "rgba(18,18,18,0.72)",
  glassTint: "rgba(0,0,0,0.5)",
  glassEdge: "rgba(0,0,0,0.6)",
  glassTintRgb: "10,11,13",
  glassFillRgb: "20,21,25",
};

const LIGHT: Palette = {
  canvas: "#EBE4D3",
  card: "rgba(0,0,0,0.05)",
  border: "rgba(0,0,0,0.20)",
  borderStrong: "rgba(0,0,0,0.38)",
  hairline: "rgba(0,0,0,0.15)",
  shine: "rgba(255,255,255,0)",
  lift: "rgba(74,60,38,0.13)",

  text: "#1A1612",
  sub: "#585147",
  dim: "#645B50",
  figureTail: "#83796B",
  placeholder: "rgba(0,0,0,0.45)",
  silver: "#585147",
  accent: "#5C554C",

  up: "#096740",
  upBg: "rgba(9,103,64,0.14)",
  down: "#B42127",
  live: "#34691A",
  amber: "#805600",
  amberInk: "#FFFFFF",
  highlight: "#586405",
  highlightInk: "#FFFFFF",
  ink: "#0a0a0a",
  sheet: "#FCF6EB",
  key: "#FCF6EB",

  // Graphite rather than silver: a brushed bright face has no presence on a
  // light ground, so the light-mode object is a dark milled face lit from the
  // same angle — and its ink flips to white with it.
  metal: ["#5A6068", "#31363D", "#4A5058", "#20242A"],
  metalShine: "rgba(255,255,255,0.35)",
  metalInk: "#FFFFFF",

  brand: "#35631C",
  brandInk: "#FFFFFF",
  brandSoft: "#2A4F16",
  brandGrad: ["#457F27", "#234412"],
  brandSoftInk: "#FFFFFF",
  brandGlow: "rgba(53,99,28,0.16)",
  brandPressFace: "#B7DA9C",
  brandPressInk: "#1E3C0C",
  brandPressGlow: "rgba(53,99,28,0.30)",

  green: "#286B27",
  greenInk: "#FFFFFF",
  greenGlow: "rgba(40,107,39,0.16)",

  raised: "rgba(252,246,235,1)",
  inset: "#E0D8C6",

  glass: "rgba(253,250,244,0.9)",
  glassTint: "rgba(255,255,255,0.6)",
  glassEdge: "rgba(235,228,211,0.75)",
  glassTintRgb: "255,255,255",
  glassFillRgb: "250,246,238",
};

/**
 * A palette colour at a given opacity.
 *
 * The tints in this app used to be written out as finished strings —
 * `rgba(246,165,165,0.35)` in a dozen screens — which is the dark theme's rose
 * spelled out, so it stayed the dark theme's rose on the light ground. Compose
 * them from the token instead: `withAlpha(t.down, 0.35)` is that same wash in
 * whichever theme is painting.
 *
 * Hex in, `rgba()` out. Anything already carrying its own alpha (the `rgba()`
 * tokens — `card`, `border`, `glass`) is returned untouched, because a second
 * opacity applied to a value whose opacity IS the design is not a thing this
 * should silently do.
 */
export function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#")) return color;
  const hex = color.slice(1);
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : hex.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

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
 * The shadow under a raised surface — light mode's half of elevation.
 *
 * On black, a card lifts by being LIGHTER than the ground and catching a
 * specular edge (`Shine`). Neither move is available on a cream ground: the
 * card is already near the ceiling, so going lighter runs out of room, and a
 * white hairline on a cream card is nothing. The measured ceiling for value
 * alone is about 1.2:1, and reaching even that squeezes the recessed rungs flat
 * and pushes four inks below their contrast floor.
 *
 * A cast shadow has neither problem. It lands on the canvas rather than under
 * the type, so it buys separation at no cost to any contrast ratio at all.
 *
 * A `style` object and not a class, per AGENTS.md: native shadow and elevation
 * tuning is one of the listed cases a utility cannot express. Resolved on read
 * so it follows the theme — in dark every value here is inert (`lift` is fully
 * transparent and `elevation` is 0), which is what makes it safe to leave on a
 * shared component rather than branching at each call site.
 */
export const LIFT: ViewStyle = new Proxy({} as ViewStyle, {
  get(_t, key) {
    const light = colorScheme.get() === "light";
    const v: ViewStyle = {
      shadowColor: light ? LIGHT.lift : "transparent",
      shadowOpacity: light ? 1 : 0,
      shadowRadius: light ? 10 : 0,
      shadowOffset: { width: 0, height: light ? 3 : 0 },
      elevation: light ? 2 : 0,
    };
    return v[key as keyof ViewStyle];
  },
  ownKeys: () => [
    "shadowColor",
    "shadowOpacity",
    "shadowRadius",
    "shadowOffset",
    "elevation",
  ],
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
