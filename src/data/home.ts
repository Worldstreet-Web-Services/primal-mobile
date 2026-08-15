import type { Feature, MediaItem, Space } from "@/components/home";

/**
 * Home shelf content. Static today; the shapes match what the home endpoint
 * will return so swapping in the API is a data-source change, not a UI change.
 * Artwork ships with the app (assets/images); a card falls back to its glass
 * placeholder whenever a render is missing.
 */

/** Everything the user holds, across every space — one ledger underneath. */
export const portfolioTotal = "$18,585.60";

// Glass mini-icons (Higgsfield, 2026-08-14) — free-floating illustrations,
// not wordmarks: bull = Market, ringed globe = World Street, chain links =
// LinkPay, coin stack = Kash.
export const spaces: Space[] = [
  {
    key: "market",
    label: "Market",
    artwork: require("../../assets/images/spaces/market.png"),
  },
  {
    key: "worldstreet",
    label: "World Street",
    artwork: require("../../assets/images/spaces/worldstreet.png"),
  },
  {
    key: "linkpay",
    label: "LinkPay",
    artwork: require("../../assets/images/spaces/linkpay.png"),
  },
  {
    key: "kash",
    label: "Kash",
    artwork: require("../../assets/images/spaces/kash.png"),
  },
];

export const features: Feature[] = [
  {
    key: "auto-earn",
    title: "Auto Earn",
    kicker: "Points settle weekly",
    poweredBy: "Ark",
    artwork: require("../../assets/images/features/auto-earn.png"),
  },
  {
    key: "copy-trading",
    title: "Copy Trading",
    kicker: "Mirror top traders",
    poweredBy: "Worldstreet",
    artwork: require("../../assets/images/features/copy-trading.png"),
  },
  {
    key: "crypto",
    title: "Crypto",
    kicker: "Every chain, one address",
    poweredBy: "LinkPay",
    artwork: require("../../assets/images/features/crypto.png"),
  },
  {
    key: "fiat",
    title: "Fiat",
    kicker: "Your account number",
    poweredBy: "LinkPay",
    artwork: require("../../assets/images/features/fiat.png"),
  },
  {
    key: "games",
    title: "Games$",
    kicker: "Outlast the clock",
    poweredBy: "Ark",
    artwork: require("../../assets/images/features/games.png"),
  },
];

export const media: MediaItem[] = [
  {
    key: "podcast",
    title: "Podcast",
    artwork: require("../../assets/images/media/podcast.png"),
  },
  {
    key: "news",
    title: "The News",
    artwork: require("../../assets/images/media/hot-news.png"),
  },
];
