import type {
  ActivityItem,
  Feature,
  MediaItem,
  Space,
} from "@/components/home";

/**
 * Home shelf content: the doorways and the editorial rail. Artwork ships with
 * the app (assets/images); a card falls back to its glass placeholder whenever
 * a render is missing.
 *
 * NOTHING IN HERE IS MONEY, and nothing in here may become money. This file
 * used to export `portfolioTotal = "$10,383.42"` and a `+$3,204.18 · +6.9% this
 * month` move, which `HomeScreen` rendered through `BalanceCard` as "TRADING
 * BALANCE · IN USD" — the first figure a member saw after paying USD 1,000, in
 * the app's largest type, invented. Both are gone. The home balance now comes
 * from `useFiatBalance()` and the crypto store, and says so plainly when it
 * cannot be read; see `src/app/home.tsx`.
 *
 * The shelves below are copy and artwork — a card's `kicker` describes what a
 * space IS, never what is in it, so nothing here can be mistaken for a figure.
 */

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
    title: "Auto Earn",
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
    byline: "KashPlus Desk",
    duration: "4 min read",
    artwork: require("../../assets/images/media/hot-news.png"),
  },
];

/**
 * SAMPLE ROWS — NOT DATA. Nothing here has happened to anybody.
 *
 * Rendered only when `EXPO_PUBLIC_DEV_SAMPLE_ACTIVITY` is set in a dev build
 * (see `src/lib/devMode.ts`), so the home screen can be compared against the
 * design reference with its activity card populated. The real card is fed by a
 * ledger endpoint that does not exist yet; until it does, a member sees the
 * card's empty sentence instead of these.
 *
 * Wired to nothing. If you find yourself importing this outside the dev gate,
 * that is the bug — the same one that once put "$10,383.42" in this file.
 */
export const sampleActivity: ActivityItem[] = [
  {
    key: "allocation",
    title: "Capital Allocation Modified",
    note: "Capital allocation increased by +$500.00 USD.",
    when: "10m ago",
    fresh: true,
  },
  {
    key: "avax",
    title: "Duplicated Order: AVAX/USDT",
    note: "Bought 12 AVAX at $26.10 USD.",
    when: "1d ago",
  },
];
