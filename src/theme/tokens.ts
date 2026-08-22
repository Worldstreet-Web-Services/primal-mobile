export const C = {
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
  // Gain / money-in. The "no green anywhere" instruction that made this gold is
  // gone with the green brand, so the pair is back to the conventional mint
  // against rose. Deliberately a MINT and not `brand`: a credit in a list must
  // never be mistaken for a brand action sitting in the same row, and with both
  // in the green family hue is the only thing keeping them apart.
  up: "#7CE7B0",
  upBg: "rgba(124,231,176,0.12)",
  down: "#f6a5a5",
  // Liveness: markets open, a round in play, a stream running. A pale green-white
  // so it reads as a lit signal rather than a figure — distinct from `amber`
  // (pending, orange) and from `brand`. Never used for money.
  live: "#DCF3CC",
  amber: "#F5B83D",
  // Marks the current instant on a chart surface — the live price tag, the
  // selected range. A chartreuse: same family as `brand` but pushed to the
  // yellow edge and a step brighter, so it reads as "this one, now" against the
  // brand rather than as a second accent. Never a money semantic.
  highlight: "#D9F24B",
  highlightInk: "#12180A",
  ink: "#0a0a0a",
  /**
   * Sheets used to sit *below* the ground so a modal read as depth rather than
   * lift. On a black canvas there is nothing below to go to, so this is now a
   * hair above it and the separation comes from the sheet's own hairline and
   * grabber instead.
   */
  sheet: "#0A0A0A",
  key: "#161617",
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

  // Brand leaf green, 2026-08-14 — and these are the values `tailwind.config.js`
  // has carried since. This file was left on the old gold (#E3B62F) until
  // 2026-08-22, which is why the running app still showed gold everywhere: the
  // app paints from `C`, not from classes, so tailwind's green never rendered.
  // The two files are the same palette in two syntaxes; change one, change both.
  //
  // Named by role, not hue, so the next change is a value and nothing else.
  // `brand` is the action colour; `brandSoft` is the muted surface cousin the
  // chrome sits on — never mix the two roles. 9.5:1 on the black canvas, so it
  // clears the small-text floor as ink and not just as fill.
  brand: "#83BE60",
  brandInk: "#0A1405",
  brandSoft: "#74AC55",
  // Lit face to shadow, for a raked fill on the mark and the primary CTA.
  brandGrad: ["#9BD177", "#5E9440"] as [string, string],
  brandSoftInk: "#081103",
  brandGlow: "rgba(131,190,96,0.14)",

  green: "#65BB64",
  /** Ink for a solid-green fill. Near-black, not white. */
  greenInk: "#06140A",
  /** The same green as a surface wash — a lit halo, a soft tile behind art. */
  greenGlow: "rgba(101,187,100,0.14)",

  // Elevation steps above the canvas. Both moved DOWN with the ground on
  // 2026-08-21 — a #2B2B2C card on a black screen reads as a slab sitting on
  // the glass rather than as a surface a step up from it. The ramp between the
  // two is what carries depth now, not their absolute value.
  raised: "#14141495",
  inset: "#1E1E20",

  // Translucent chrome (floating tab bar, sheets). `glass` is the fill used
  // where no native blur exists; `glassTint` colors the native glass effect.
  glass: "rgba(18,18,18,0.72)",
  glassTint: "rgba(0,0,0,0.5)",
  // Top stop of the falloff under the nav glass — fades to transparent.
  glassEdge: "rgba(0,0,0,0.6)",
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
/**
 * SWAPPING IN INTER (pending — the client is supplying the files, 2026-08-21).
 *
 * The 2026-08-21 home and sign-in references are set in Inter, not Urbanist.
 * The swap is deliberately two edits and no more, because every point size in
 * the app is tuned against the family below:
 *
 *   1. drop `Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`,
 *      `Inter-Bold.ttf` and `Inter-ExtraBold.ttf` into `assets/fonts/`, and
 *      add them to the `useFonts` map in `src/app/_layout.tsx` — the names in
 *      that map are the names `F` resolves to, so they must match exactly;
 *   2. change the five values below from `Urbanist-*` to `Inter-*`.
 *
 * Nothing else. Do NOT rename the KEYS — ~40 files import `F.display` and
 * friends by role, and the roles do not change with the family.
 *
 * Expect to re-check two things afterwards, because Inter's metrics are not
 * Urbanist's: Inter runs wider at the same point size (the sign-in headline and
 * the tab labels are the tightest lines in the app), and its default line box
 * is taller, so anything with an explicit `lineHeight` sits differently. Both
 * are visual passes, not code changes.
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
