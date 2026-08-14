export const C = {
  canvas: '#0A0B0D',
  card: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.12)',
  borderStrong: 'rgba(255,255,255,0.3)',
  hairline: 'rgba(255,255,255,0.08)',
  text: '#F2F4F6',
  sub: '#9BA1A8',
  dim: '#6A7078',
  silver: '#C7CCD1',
  accent: '#d4d4d8',   // Ark silver accent
  up: '#E9D08A',       // gain / money-in — pale gold (semantic, distinct from action gold)
  upBg: 'rgba(233,208,138,0.12)',
  down: '#f6a5a5',
  // Pending/warning. Pushed orange so it can't be mistaken for action gold.
  amber: '#F59A3D',
  ink: '#0a0a0a',
  sheet: '#0f1012',
  key: '#14161A',
  metal: ['#e8e8ea', '#b6b6bc'] as [string, string], // Last Man CTA gradient

  // Brand golds (rebrand 2026-08-14, was the green family). `lime` keeps its
  // token NAME so no call site churns — it is the action color, now golden;
  // `leaf` is the muted surface cousin the ecosystem art sits on — never mix
  // the two roles.
  lime: '#F5C842',
  limeInk: '#171200',
  leaf: '#B99A45',
  leafGrad: ['#D4B465', '#A8833F'] as [string, string],
  leafInk: '#151003',
  limeGlow: 'rgba(245,200,66,0.14)',
  dollar: '#9A7B1C',
  dollarTint: 'rgba(154,123,28,0.15)',

  // Elevation steps above the canvas.
  raised: '#141519',
  inset: '#1C1E24',

  // Translucent chrome (floating tab bar, sheets). `glass` is the fill used
  // where no native blur exists; `glassTint` colors the native glass effect.
  glass: 'rgba(20,21,25,0.72)',
  glassTint: 'rgba(10,11,13,0.5)',
  // Top stop of the falloff under the nav glass — fades to transparent.
  glassEdge: 'rgba(10,11,13,0.55)',
};

export const F = {
  display: 'SpaceGrotesk-SemiBold',
  displayBold: 'SpaceGrotesk-Bold',
  body: 'Geist-Regular',
  bodyMedium: 'Geist-Medium',
  bodySemibold: 'Geist-SemiBold',
  mono: 'GeistMono-Regular',
  monoSemibold: 'GeistMono-SemiBold',
};
