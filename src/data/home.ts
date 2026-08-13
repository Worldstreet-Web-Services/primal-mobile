import type { Feature, MediaItem, Space } from "@/components/home";

/**
 * Home shelf content. Static today; the shapes match what the home endpoint
 * will return so swapping in the API is a data-source change, not a UI change.
 * Artwork is intentionally absent — the cards render their glass placeholder
 * until the renders land in assets/images.
 */

export const spaces: Space[] = [
  {
    key: "market",
    label: "Market",
    artwork: require("../../assets/images/market.png"),
  },
  { key: "worldstreet", label: "World Street" },
  {
    key: "linkpay",
    label: "LinkPay",
    artwork: require("../../assets/images/linkpay.png"),
  },
  { key: "kash", label: "Kash" },
];

export const features: Feature[] = [
  { key: "auto-earn", title: "Auto Earn", poweredBy: "Ark", tone: "dark" },
  {
    key: "copy-trading",
    title: "Copy Trading",
    poweredBy: "Worldstreet",
  },
  {
    key: "crypto",
    title: "Cypto",
    poweredBy: "LinkPay",
  },
  {
    key: "games",
    title: "Games$",
    poweredBy: "Ark",
  },
];

export const media: MediaItem[] = [
  { key: "podcast", title: "Podcast" },
  { key: "news", title: "The News" },
];
