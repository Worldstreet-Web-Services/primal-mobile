/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#FFC93D",
          ink: "#1A1200",
          soft: "#DDB35A",
          "soft-ink": "#150E00",
        },
        up: { DEFAULT: "#7CE7B0", tint: "#7CE7B01F" },
        down: { DEFAULT: "#F6A5A5" },
        canvas: { DEFAULT: "#0A0B0D", raised: "#141519", inset: "#1C1E24" },
        silver: { DEFAULT: "#C7CCD1", muted: "#8A9096", faint: "#4A4F56" },
      },
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
