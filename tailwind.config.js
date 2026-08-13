/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Brand (PRD §5): lime = action, dollar = money-in/positive,
        // canvas = metallic black ground, silver = chrome/secondary.
        lime: { DEFAULT: "#B4FF39", ink: "#101400" },
        dollar: { DEFAULT: "#118C4F", tint: "#118C4F26" },
        canvas: { DEFAULT: "#0A0B0D", raised: "#141519", inset: "#1C1E24" },
        silver: { DEFAULT: "#C7CCD1", muted: "#8A9096", faint: "#4A4F56" },
      },
      // Mirrors `F` in src/theme/tokens.ts — keep the two in step.
      fontFamily: {
        display: ["SpaceGrotesk-SemiBold"],
        "display-bold": ["SpaceGrotesk-Bold"],
        body: ["Geist-Regular"],
        "body-medium": ["Geist-Medium"],
        "body-semibold": ["Geist-SemiBold"],
        mono: ["GeistMono-Regular"],
        "mono-semibold": ["GeistMono-SemiBold"],
      },
    },
  },
  plugins: [],
};
