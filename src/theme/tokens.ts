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
  up: '#7ce7b0',       // gain / money-in (semantic, from wsws-frontend)
  upBg: 'rgba(124,231,176,0.12)',
  down: '#f6a5a5',
  amber: '#F5B83D',
  ink: '#0a0a0a',
  sheet: '#0f1012',
  key: '#14161A',
  metal: ['#e8e8ea', '#b6b6bc'] as [string, string], // Last Man CTA gradient

  // Brand greens (PRD §5). `lime` is the action color; `leaf` is the muted
  // surface cousin the ecosystem art sits on — never mix the two roles.
  lime: '#B4FF39',
  limeInk: '#101400',
  leaf: '#9BC95A',
  leafGrad: ['#A8D465', '#7BA83F'] as [string, string],
  leafInk: '#0E1503',
  limeGlow: 'rgba(180,255,57,0.14)',
  dollar: '#118C4F',
  dollarTint: 'rgba(17,140,79,0.15)',

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
