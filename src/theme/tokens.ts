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
  /**
   * The three text tiers, re-spaced 2026-08-16 for contrast on the charcoal
   * ground. `dim` was #6A7078, which measured 2.52:1 on `inset` and 3.14:1 on
   * the canvas — under the 4.5:1 body-text floor everywhere it was used, and
   * worst precisely where it mattered most (the deposit address a user is told
   * to check against their wallet). `sub` moved up with it to keep three
   * readable steps rather than two.
   *
   * Worst case on any surface (canvas/raised/inset/sheet): text 11.4:1,
   * sub 6.0:1, dim 4.45:1. Re-measure before changing any of them — the grounds
   * are close together, so a small move here fails silently.
   */
  text: "#F2F4F6",
  sub: "#AEB4BB",
  dim: "#949AA3",
  silver: "#C7CCD1",
  accent: "#d4d4d8", // Ark silver accent
  // Gain / money-in. Warm rather than green: no green anywhere by instruction
  // (2026-08-16), so the up/down pair is gold against rose instead of the
  // conventional green against red. Kept lighter than `brand` so a credit in a
  // list is never mistaken for a brand action sitting in the same row.
  up: "#F0C75A",
  upBg: "rgba(240,199,90,0.12)",
  down: "#f6a5a5",
  // Liveness: markets open, a round in play, a stream running. A pale gold-white
  // so it reads as a lit signal rather than a figure — distinct from `amber`
  // (pending, more orange) and from `brand`. Never used for money.
  live: "#FFE9A3",
  amber: "#F5B83D",
  // Marks the current instant on a chart surface — the live price tag, the
  // selected range. Was a chartreuse, which is still a green; now a bright gold
  // a step brighter than `brand`, so it reads as "this one, now" against the
  // brand rather than as a second accent.
  highlight: "#FFD75E",
  highlightInk: "#1A1304",
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

  // Brand gold, 2026-08-16 — sampled off the mark itself (its lit face reads
  // #EDC104, rolling to #B58001 in shadow) and pulled back a little so it holds
  // as UI rather than as artwork. There is NO green anywhere in this palette by
  // instruction: the mark is gold, the actions are metal, and the ground is
  // charcoal. Named by role, not hue, so the next change is a value and nothing
  // else. `brand` is the action colour; `brandSoft` is the muted surface cousin
  // the chrome sits on — never mix the two roles.
  brand: "#E3B62F",
  brandInk: "#1A1304",
  brandSoft: "#C79C28",
  brandGrad: ["#F2CE5C", "#B8891F"] as [string, string],
  brandSoftInk: "#150F03",
  brandGlow: "rgba(227,182,47,0.14)",

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
