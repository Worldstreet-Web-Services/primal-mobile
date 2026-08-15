import type { ImageSource } from "expo-image";

/**
 * The News feed. Static stand-in for the editorial endpoint — the shapes match
 * what it will return, so swapping the source is a data change, not a UI one.
 *
 * Every `image` is deliberately unset: the renders aren't in the project yet,
 * and `ArtSlot` draws its glass placeholder wherever one is missing. Drop a
 * `require(...)` in as each asset lands.
 */

export interface Article {
  key: string;
  title: string;
  /** Publisher line — carried in the brand color wherever it appears. */
  channel: string;
  /** Pre-formatted age, e.g. "36min ago". The UI never does date math. */
  age: string;
  image?: ImageSource | number;
}

/** Lead story: one headline over a three-up gallery. */
export interface FeaturedArticle extends Article {
  /** Lead render first, then the two supporting ones. */
  gallery: (ImageSource | number | undefined)[];
}

export const categories = [
  "All news",
  "Business",
  "Politics",
  "Tech",
  "Healthy",
  "Science",
];

export const featured: FeaturedArticle = {
  key: "vegetable-garden",
  title:
    "Making the Most of Outdoor Space for a Bountiful and Beautiful Vegetable Garden",
  channel: "Nature Channel",
  age: "36min ago",
  gallery: [undefined, undefined, undefined],
};

export const latest: Article[] = [
  {
    key: "arctic-warming",
    title: "Climate change: Arctic warming linked to colder winters",
    channel: "Nature Channel",
    age: "4min ago",
  },
  {
    key: "tokyo-paralympics",
    title: "Tokyo Paralympics: Great Britain win gold and pass 100 medals",
    channel: "BBC Sport",
    age: "12min ago",
  },
  {
    key: "energy-prices",
    title: "Energy prices ease as storage levels beat winter forecasts",
    channel: "Reuters",
    age: "38min ago",
  },
];

export const recommended: Article[] = [
  {
    key: "us-jobs",
    title: "US jobs growth disappoints as recovery falters",
    channel: "Financial Times",
    age: "1h ago",
  },
  {
    key: "chip-supply",
    title: "Chipmakers signal the supply crunch is finally turning",
    channel: "Bloomberg",
    age: "2h ago",
  },
  {
    key: "housing-starts",
    title: "Housing starts climb for a third straight month",
    channel: "Reuters",
    age: "3h ago",
  },
];
