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
   * The three text tiers, re-derived 2026-08-16 (second pass).
   *
   * The first pass raised `sub` #9BA1A8 → #AEB4BB and `dim` #6A7078 → #949AA3
   * to get off the floor, and got two things wrong.
   *
   * `dim` still did not clear the floor: #949AA3 measures 4.45:1 on `inset`,
   * 4.47:1 on the subscribe slab, 4.48:1 on the GreetingHero slab. It is set at
   * 9–12pt — `Label` is 10pt — so no large-text exemption applies and 4.45:1 is
   * a fail, not a near miss. And the tiers collapsed into two: sub-vs-dim fell
   * from 1.92:1 to 1.36:1, so a caption and a subtitle stopped being different
   * things.
   *
   * These values are the even solution to both, measured against every ground
   * the app actually draws on: canvas #232323, raised #2B2B2C, inset #333335,
   * sheet #1A1A1A, key #2C2C2D, the subscribe slab #3A3222, the GreetingHero
   * slab #2F3524, and a Card over canvas (#323232, `C.card` composited).
   * `inset` is the lightest of the eight, so it sets the floor:
   *
   *   text  #F2F4F6 — 11.43:1 inset · 14.25:1 canvas · 15.79:1 sheet
   *   sub   #C0C6CE —  7.33:1 inset ·  9.14:1 canvas · 10.12:1 sheet
   *   dim   #989EA7 —  4.67:1 inset ·  5.83:1 canvas ·  6.45:1 sheet
   *
   * Neighbour steps: text/sub 1.56:1, sub/dim 1.57:1, text/dim 2.45:1.
   *
   * That 2.45:1 is a CEILING, not a preference. Pin `dim` at exactly 4.5:1 on
   * `inset` and pull `text` all the way to pure white, and the widest text/dim
   * that can exist is 2.80:1 — three even rungs inside it is 1.6:1 a step. The
   * old text/dim 4.53:1 was only ever affordable because `dim` was failing.
   * So do not buy separation back by darkening `dim`: there is none for sale,
   * and what pays for it is whether the caption can be read at all. Where a
   * split has to read harder than 2.45:1, the type is large and the token for
   * it is `figureTail`.
   */
  text: "#F2F4F6",
  sub: "#C0C6CE",
  dim: "#989EA7",
  /**
   * The quiet half of a compound figure: the cents in "$1,204.30", the ticker
   * in "0.031 ETH", the ".00" on a confirm slab.
   *
   * LARGE TEXT ONLY — every use must be ≥24pt, or ≥18.7pt bold. `Display` is
   * Urbanist-Bold, so ≥19pt there; the four call sites are 22–26pt. WCAG's
   * floor at that size is 3:1, not 4.5:1, which is the whole reason this token
   * can exist: 3.17:1 on inset, 3.95:1 on canvas, 4.38:1 on sheet, and 3.61:1
   * away from `text` — enough to make the split read, where the body tiers'
   * 2.45:1 ceiling cannot.
   *
   * It is NOT a fourth text tier. Set anything under 19pt in it and the type
   * fails outright; `dim` is the token there.
   */
  figureTail: "#7A808A",
  /**
   * A placeholder is not quiet text. It is the absence of text, and it has to
   * look like one.
   *
   * Colouring an empty amount field `dim` is what made an empty withdraw field
   * read as one that already had a value in it: at the top of a keypad flow the
   * only difference between "0.000" waiting and "0.000" typed was 2.45:1 of
   * grey, at 40pt, on the screen where the mistake costs money. This is
   * deliberately a translucent white rather than a rung — 1.92:1 on canvas — so
   * ghost digits read as scaffolding rather than as a figure, and 7.43:1 from
   * `text`, so the first keypress is unmistakable.
   *
   * The trade is that it is far too faint to carry meaning, so it may only be
   * used where a contrast-passing line says the same thing beside it ("Enter an
   * amount to withdraw"). That sentence is the text; the ghost digits are
   * decoration. Never put anything here that a user has to read.
   */
  placeholder: "rgba(255,255,255,0.20)",
  /**
   * The metal-register name for the `sub` rung — not a rung of its own.
   *
   * `Mono` defaults to it and ~90 call sites reach for it as icon and chrome
   * ink, which made it look like a fourth tier in the hierarchy audit. It
   * measured 1.06:1 from the re-derived `sub`: the same colour, to the eye and
   * nearly to the instrument. So it now *is* `sub`, and the phantom rung is
   * gone. If you want one step down from `text`, this is that step; there is
   * nothing between them.
   */
  silver: "#C0C6CE",
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
