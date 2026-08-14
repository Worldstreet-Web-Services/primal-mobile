import type { Feature, MediaItem, Space } from "@/components/home";

/**
 * Home shelf content. Static today; the shapes match what the home endpoint
 * will return so swapping in the API is a data-source change, not a UI change.
 * Artwork is intentionally absent — the cards render their glass placeholder
 * until the renders land in assets/images.
 */

/** Everything the user holds, across every space — one ledger underneath. */
export const portfolioTotal = "$18,585.60";

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
  {
    key: "auto-earn",
    title: "Auto Earn",
    kicker: "Points settle weekly",
    poweredBy: "Ark",
    artwork: require("../../assets/images/auto-earn.png"),
  },
  {
    key: "copy-trading",
    title: "Copy Trading",
    kicker: "Mirror top traders",
    poweredBy: "Worldstreet",
    artwork: require("../../assets/images/copy-trade.png"),
  },
  {
    key: "crypto",
    title: "Crypto",
    kicker: "Every chain, one address",
    poweredBy: "LinkPay",
    artwork: require("../../assets/images/crypto.png"),
  },
  {
    key: "games",
    title: "Games$",
    kicker: "Outlast the clock",
    poweredBy: "Ark",
    artwork: require("../../assets/images/games.png"),
  },
];

export const media: MediaItem[] = [
  { key: "podcast", title: "Podcast" },
  { key: "news", title: "The News" },
];
