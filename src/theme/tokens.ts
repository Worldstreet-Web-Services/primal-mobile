export const C = {
  canvas: "#0A0B0D",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.3)",
  hairline: "rgba(255,255,255,0.08)",
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
  sheet: "#0f1012",
  key: "#14161A",
  metal: ["#e8e8ea", "#b6b6bc"] as [string, string], // Last Man CTA gradient

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

  // Elevation steps above the canvas.
  raised: "#141519",
  inset: "#1C1E24",

  // Translucent chrome (floating tab bar, sheets). `glass` is the fill used
  // where no native blur exists; `glassTint` colors the native glass effect.
  glass: "rgba(20,21,25,0.72)",
  glassTint: "rgba(10,11,13,0.5)",
  // Top stop of the falloff under the nav glass — fades to transparent.
  glassEdge: "rgba(10,11,13,0.55)",
};

export const F = {
  // Mona Sans headers over Geist body — the wsws-frontend pairing.
  display: "MonaSans-SemiBold",
  displayBold: "MonaSans-Bold",
  body: "Geist-Regular",
  bodyMedium: "Geist-Medium",
  bodySemibold: "Geist-SemiBold",
  mono: "GeistMono-Regular",
  monoSemibold: "GeistMono-SemiBold",
};
