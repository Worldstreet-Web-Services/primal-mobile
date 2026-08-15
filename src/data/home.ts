import type { Feature, MediaItem, Space } from "@/components/home";

/**
 * Home shelf content. Static today; the shapes match what the home endpoint
 * will return so swapping in the API is a data-source change, not a UI change.
 * Artwork ships with the app (assets/images); a card falls back to its glass
 * placeholder whenever a render is missing.
 */

/** Everything the user holds, across every space — one ledger underneath. */
export const portfolioTotal = "$10,383.42";

/** The move on `portfolioTotal`, over the window named in the caption. */
export const portfolioDelta = {
  value: "+$3,204.18",
  caption: "+6.9% this month",
};

/** Sits under the name in the home header. */
export const tagline = "Built for the top";

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

// Order is the layout: the first three share the top row, the last two split
// the wider row beneath it. See `FeatureGrid`'s `rows`.
export const features: Feature[] = [
  {
    key: "auto-earn",
    title: "Yield",
    kicker: "Points settle weekly",
    poweredBy: "Ark",
    artwork: require("@/assets/images/features/auto-earn.png"),
  },

  {
    key: "crypto",
    title: "Crypto",
    kicker: "Every chain, one address",
    poweredBy: "LinkPay",
    artwork: require("@/assets/images/features/crypto.png"),
  },
  {
    key: "fiat",
    title: "Fiat",
    kicker: "Your account number",
    poweredBy: "LinkPay",
    artwork: require("@/assets/images/features/fiat.png"),
  },
  {
    key: "games",
    title: "Games",
    kicker: "Outlast the clock",
    poweredBy: "Ark",
    artwork: require("@/assets/images/features/games.png"),
  },
  {
    key: "copy-trading",
    title: "Copy Trading",
    kicker: "Mirror top traders",
    poweredBy: "Worldstreet",
    artwork: require("@/assets/images/features/copy-trading.png"),
  },
];

// `kind` is what the rail's Podcast/News switch filters on — drop it from an
// item and it shows under both.
export const media: MediaItem[] = [
  {
    key: "podcast",
    kind: "podcast",
    title: "How to hold the market",
    kicker: "Now playing",
    byline: "The Win Team",
    duration: "1:12:40",
    artwork: require("../../assets/images/media/podcast.png"),
  },
  {
    key: "news",
    kind: "news",
    title: "The week the desk stopped",
    kicker: "Hot news",
    byline: "Paradigm Desk",
    duration: "4 min read",
    artwork: require("../../assets/images/media/hot-news.png"),
  },
];
