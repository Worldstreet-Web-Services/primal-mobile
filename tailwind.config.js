/** @type {import('tailwindcss').Config} */

/**
 * Colours and families live in `src/global.css`, not here. This file only names
 * them, so a value change is one edit in one file.
 *
 * Two shapes, matching the two formats documented in that file:
 *
 *   rgb(var(--x) / <alpha-value>)  solid, and takes an opacity modifier
 *                                  (`text-brand/70`, `bg-canvas/50`)
 *   var(--x)                       translucency is part of the token, so no
 *                                  opacity modifier applies
 */
const solid = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const raw = (name) => `var(--${name})`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // Required, and not cosmetic: on "media" NativeWind only reads the OS
  // setting, and `colorScheme.set()` has nothing to switch. `.dark:root` in
  // global.css is matched off this class too.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ------------------------------------------------------------ ground
        canvas: {
          DEFAULT: solid("canvas"),
          raised: raw("canvas-raised"),
          inset: solid("canvas-inset"),
        },
        sheet: solid("sheet"),
        key: solid("key"),
        ink: solid("ink"),

        // -------------------------------------------------------------- text
        text: solid("text"),
        sub: solid("sub"),
        dim: solid("dim"),
        silver: {
          DEFAULT: solid("silver"),
          muted: solid("silver-muted"),
          faint: solid("silver-faint"),
        },
        "figure-tail": solid("figure-tail"),
        accent: solid("accent"),
        placeholder: raw("placeholder"),

        // ------------------------------------------------------------- lines
        card: raw("card"),
        border: raw("border"),
        "border-strong": raw("border-strong"),
        // NOT `hairline`: nativewind's preset already owns that name as a
        // borderWidth, so `border-hairline` would emit a width rule AND a
        // colour rule from one class. `rule` is the colour; the two compose the
        // way they read — `border-hairline border-rule` is a hairline-width
        // rule. The CSS variable keeps the design's own word for it.
        rule: raw("hairline"),

        // ------------------------------------------------------------- brand
        brand: {
          DEFAULT: solid("brand"),
          ink: solid("brand-ink"),
          soft: solid("brand-soft"),
          "soft-ink": solid("brand-soft-ink"),
          glow: raw("brand-glow"),
        },
        green: {
          DEFAULT: solid("green"),
          ink: solid("green-ink"),
          glow: raw("green-glow"),
        },

        // ------------------------------------------------------------- money
        // Never paint a gain in the brand colour — see global.css.
        up: { DEFAULT: solid("up"), tint: raw("up-tint") },
        down: solid("down"),

        // ----------------------------------------------------------- signals
        live: solid("live"),
        amber: solid("amber"),
        highlight: { DEFAULT: solid("highlight"), ink: solid("highlight-ink") },

        // ------------------------------------------------------- metal/glass
        // The four gradient stops stay out of here: they are a LinearGradient
        // `colors` array, which is a prop and not a style. `tokens.ts` owns
        // those. Only the two that are ordinary colours appear as classes.
        "metal-ink": solid("metal-ink"),
        "metal-shine": raw("metal-shine"),
        glass: {
          DEFAULT: raw("glass"),
          tint: raw("glass-tint"),
          edge: raw("glass-edge"),
        },
      },
      fontFamily: {
        // Urbanist throughout, 2026-08-16 — one family, five static instances.
        // RN resolves `fontFamily` to a concrete face, so weight axes on a
        // variable TTF never land on Android.
        //
        // These are the faces `useFonts` actually loads in `src/app/_layout.tsx`
        // and the same ones `F` names. This block used to say SpaceGrotesk and
        // Geist, neither of which the app has ever loaded, so every `font-*`
        // class in the app was silently falling back to the system face.
        //
        // `mono` keeps its name for the ROLE it plays — figures, account
        // numbers, tracked labels — not the face. Urbanist has no monospace
        // cut, so column alignment comes from `fontVariant: ["tabular-nums"]`
        // on the `Mono` component rather than from the family.
        display: ["Urbanist-Bold"],
        "display-bold": ["Urbanist-ExtraBold"],
        body: ["Urbanist-Regular"],
        "body-medium": ["Urbanist-Medium"],
        "body-semibold": ["Urbanist-SemiBold"],
        mono: ["Urbanist-Medium"],
        "mono-semibold": ["Urbanist-SemiBold"],
      },
    },
  },
  plugins: [],
};
