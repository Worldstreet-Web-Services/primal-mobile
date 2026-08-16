import type { MediaItem } from "@/components/home";
import type { Author, Episode } from "@/components/podcast";
import { C } from "@/theme/tokens";

/**
 * Podcast shelf content. Artwork is unset throughout — every surface falls back
 * to its glass placeholder, so the layout is final before the renders land.
 * Drop an `artwork: require(...)` on any item to fill it in.
 */

export const nowPlaying: MediaItem = {
  key: "spirit-realm",
  title: "How to control money from the spirit realm",
  kicker: "Now playing.....",
  byline: "By Pastor Chris Oyakhilome 2023",
  kind: "podcast",
  actionLabel: "Play now",
  artwork: require("@/assets/images/media/podcast.png"),
};

export const podcastTabs = ["Recent", "Topics", "Author", "Episodes"];

export const episodes: Episode[] = [
  {
    key: "ep-12",
    title: "The optimistic fill, explained",
    progress: 0.42,
    elapsed: "02:33",
  },
  { key: "ep-11", title: "Reading the market pulse" },
  { key: "ep-10", title: "Kash points, settled weekly" },
  { key: "ep-09", title: "Copy-trading without the guesswork" },
  { key: "ep-08", title: "Passkeys, PINs and your money" },
  {
    key: "ep-07",
    title: "What the desk watches at open",
    progress: 0.18,
    elapsed: "00:58",
  },
  { key: "ep-06", title: "Stablecoins, plainly" },
  { key: "ep-05", title: "The week the market stopped" },
];

export const authors: Author[] = [
  { key: "amara", name: "Amara O.", accent: C.brand },
  { key: "zainab", name: "Zainab K." },
  { key: "tobi", name: "Tobi A." },
  { key: "kelechi", name: "Kelechi N." },
  { key: "dami", name: "Dami F." },
];
