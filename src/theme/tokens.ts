export const C = {
  /**
   * Ground, 2026-08-16: a neutral charcoal, not near-black.
   *
   * Everything below it moved with it. A white overlay reads weaker on a
   * lighter ground, so the card/border/hairline alphas are all a step up from
   * what they were on #0A0B0D — same apparent weight, different arithmetic.
   */
  canvas: "#232323",
  card: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.16)",
  borderStrong: "rgba(255,255,255,0.34)",
  hairline: "rgba(255,255,255,0.11)",
  text: "#F2F4F6",
  sub: "#9BA1A8",
  dim: "#6A7078",
  silver: "#C7CCD1",
  accent: "#d4d4d8", // Ark silver accent
  up: "#7ce7b0", // gain / money-in (semantic, from wsws-frontend)
  upBg: "rgba(124,231,176,0.12)",
  down: "#f6a5a5",
  // Liveness: markets open, a round in play, a stream running. Saturated so it
  // reads as a signal light rather than a gain figure — never used for money.
  live: "#4ADE80",
  amber: "#F5B83D",
  // Marks the current instant on a chart surface — the live price tag, the
  // selected range. Deliberately not the brand green: it has to read *against*
  // candles that are already green, so it can never be a money semantic.
  highlight: "#D9F24B",
  highlightInk: "#12180A",
  ink: "#0a0a0a",
  /** Sheets sit *below* the ground, so a modal reads as depth rather than lift. */
  sheet: "#1A1A1A",
  key: "#2C2C2D",
  /**
   * Brushed metal, not flat white.
   *
   * Four stops rather than two: the bright band at 0.38 and the darker roll-off
   * at the foot are what make a surface read as a milled face catching light,
   * instead of a grey wash. Always draw it on the diagonal (see `METAL_ANGLE`)
   * — a vertical ramp reads as a gradient, a raked one reads as metal.
   */
  metal: ["#F4F6F8", "#CBD0D6", "#EAEDF0", "#A6ACB4"] as [
    string,
    string,
    string,
    string,
  ],
  /** Stop positions for `metal`; keep them together or the sheen moves. */
  metalStops: [0, 0.38, 0.62, 1] as [number, number, number, number],
  /** The specular hairline laid along a metal surface's top edge. */
  metalShine: "rgba(255,255,255,0.85)",
  /** Ink on metal — near-black, so the sheen stays the brightest thing on it. */
  metalInk: "#0B0C0E",

  // Brand leaf green, #83BE60 (2026-08-14, superseding gold). Named by role,
  // not hue, so the next rebrand is a value change and nothing else.
  // `brand` is the action color; `brandSoft` is the muted surface cousin the
  // chrome sits on — never mix the two roles, and never use either for
  // money semantics (that's `up`/`down`, which stay green/red by convention).
  brand: "#83BE60",
  brandInk: "#0A1405",
  brandSoft: "#74AC55",
  brandGrad: ["#96CF72", "#5F9440"] as [string, string],
  brandSoftInk: "#081103",
  brandGlow: "rgba(131,190,96,0.14)",

  // Elevation steps above the canvas. Both moved up with the ground — on
  // #232323 the old values read as holes punched in the screen.
  raised: "#2B2B2C",
  inset: "#333335",

  // Translucent chrome (floating tab bar, sheets). `glass` is the fill used
  // where no native blur exists; `glassTint` colors the native glass effect.
  glass: "rgba(43,43,44,0.72)",
  glassTint: "rgba(35,35,35,0.5)",
  // Top stop of the falloff under the nav glass — fades to transparent.
  glassEdge: "rgba(35,35,35,0.55)",
};

/**
 * Urbanist throughout, 2026-08-16 — one family, five weights, static instances
 * (RN resolves `fontFamily` to a concrete face, so weight axes on a variable
 * TTF never land on Android).
 *
 * `mono` is Urbanist too — every text in the app is one family now. It keeps
 * the name because of the ROLE it plays, not the face: figures, account numbers
 * and tracked labels. Urbanist has no monospace cut, so the alignment those
 * placements need comes from `fontVariant: ["tabular-nums"]` on the `Mono`
 * component rather than from the family. Set figures with `Mono` and they still
 * line up column-wise; set them with a bare `Text` and they will not.
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
