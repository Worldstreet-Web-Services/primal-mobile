import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Join class strings so a caller's class beats the component's default.
 *
 * This is not cosmetic. Tailwind resolves two conflicting utilities by their
 * order in the generated stylesheet, NOT by their order in the class string —
 * so a primitive that renders `` `text-dim ${className}` `` and is handed
 * `text-brand` may still paint dim, depending on which colour Tailwind happened
 * to emit last. `cn` drops the losing class instead of relying on that, which
 * is what makes `<Label className="text-brand">` mean what it reads as.
 *
 * The merge is extended because tailwind-merge cannot know our palette: without
 * this it reads `text-brand` and `text-silver` as unrelated (one might be a font
 * size) and keeps both. Every custom colour and family from `tailwind.config.js`
 * is declared here — add a token there, add it here.
 */
const COLORS = [
  "canvas",
  "canvas-raised",
  "canvas-inset",
  "sheet",
  "key",
  "ink",
  "text",
  "sub",
  "dim",
  "silver",
  "silver-muted",
  "silver-faint",
  "figure-tail",
  "accent",
  "placeholder",
  "card",
  "border",
  "border-strong",
  "rule",
  "brand",
  "brand-ink",
  "brand-soft",
  "brand-soft-ink",
  "brand-glow",
  "green",
  "green-ink",
  "green-glow",
  "up",
  "up-tint",
  "down",
  "live",
  "amber",
  "highlight",
  "highlight-ink",
  "metal-ink",
  "metal-shine",
  "glass",
  "glass-tint",
  "glass-edge",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "text-color": [{ text: COLORS }],
      "bg-color": [{ bg: COLORS }],
      "border-color": [{ border: COLORS }],
      "font-family": [
        {
          font: [
            "display",
            "display-bold",
            "body",
            "body-medium",
            "body-semibold",
            "mono",
            "mono-semibold",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
