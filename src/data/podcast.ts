import type { MediaItem } from "@/components/home";
import type { Author, Episode } from "@/components/podcast";

/**
 * Podcast shelf content. Artwork is unset throughout — every surface falls back
 * to its glass placeholder, so the layout is final before the renders land.
 * Drop an `artwork: require(...)` on any item to fill it in.
 *
 * ONE catalogue, two shapes. `catalog` below is the record: everything the
 * episode page and the player need to draw an episode. `episodes` is the grid's
 * view of it — key, title, artwork and how far in you are — and is DERIVED
 * rather than typed out again, so a title cannot say one thing on the wall and
 * another in the player.
 */

/** A marked point inside an episode. `at` is seconds from the start. */
export interface Chapter {
  key: string;
  title: string;
  at: number;
}

/** The full record for one episode — what `/podcast/[id]` and the player read. */
export interface PodcastEpisode {
  key: string;
  title: string;
  author: string;
  /** Blurb under the title on the episode page. */
  summary: string;
  durationSec: number;
  artwork?: number;
  chapters: Chapter[];
  /**
   * 0–1 of the way through, for an episode already started. This is mock
   * listening history; once progress is persisted it comes from there instead.
   */
  progress?: number;
}

/** `mm:ss`, or `h:mm:ss` past the hour. The one place playback time is spelt. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

export const catalog: PodcastEpisode[] = [
  {
    key: "spirit-realm",
    title: "How to control money from the spirit realm",
    author: "Pastor Chris Oyakhilome",
    summary:
      "What if money is not only a physical reality, but also connected to the spiritual realm? In this thought provoking episode, we explore the idea of spiritual influence over wealth, financial abundance, and the unseen forces believed to shape our relationship with money.",
    durationSec: 1740,
    artwork: require("@/assets/images/media/podcast.png"),
    progress: 316 / 1740,
    chapters: [
      { key: "c1", title: "Nutrition & Supplementation", at: 0 },
      { key: "c2", title: "Creating Wealth, Money & power Spirit", at: 316 },
    ],
  },
  {
    key: "ep-12",
    title: "The optimistic fill, explained",
    author: "Amara O.",
    summary:
      "Why your order shows as filled before the chain has agreed, what the desk is actually promising when it does, and the handful of cases where that promise is walked back.",
    durationSec: 1520,
    artwork: require("@/assets/images/podcaster/podcaster_1.png"),
    progress: 0.42,
    chapters: [
      { key: "c1", title: "What an optimistic fill is", at: 0 },
      { key: "c2", title: "Who carries the risk", at: 265 },
      { key: "c3", title: "When it unwinds", at: 812 },
    ],
  },
  {
    key: "ep-11",
    title: "Reading the market pulse",
    author: "Zainab K.",
    summary:
      "The four readings the pulse screen puts in front of you, and the order to read them in when the market is moving faster than you are.",
    durationSec: 1265,
    artwork: require("@/assets/images/podcaster/podcaster_2.png"),
    chapters: [
      { key: "c1", title: "The four readings", at: 0 },
      { key: "c2", title: "Reading them in order", at: 402 },
    ],
  },
  {
    key: "ep-10",
    title: "Kash points, settled weekly",
    author: "Tobi A.",
    summary:
      "Where points come from, what they are worth, and why settlement waits for the week to close rather than paying out the moment you earn them.",
    durationSec: 980,
    artwork: require("@/assets/images/podcaster/podcaster_3.png"),
    chapters: [
      { key: "c1", title: "Earning", at: 0 },
      { key: "c2", title: "Why weekly", at: 344 },
    ],
  },
  {
    key: "ep-09",
    title: "Copy-trading without the guesswork",
    author: "Kelechi N.",
    summary:
      "Picking a leader is the easy half. This one is about the other half: sizing your stake, reading a track record honestly, and knowing when to stop copying.",
    durationSec: 1810,
    artwork: require("@/assets/images/podcaster/podcaster_1.png"),
    chapters: [
      { key: "c1", title: "Reading a track record", at: 0 },
      { key: "c2", title: "Sizing the stake", at: 520 },
      { key: "c3", title: "Knowing when to stop", at: 1290 },
    ],
  },
  {
    key: "ep-08",
    title: "Passkeys, PINs and your money",
    author: "Dami F.",
    summary:
      "Three locks, three different jobs. What each one actually protects, and what happens to your account when you lose the device holding them.",
    durationSec: 1120,
    artwork: require("@/assets/images/podcaster/podcaster_2.png"),
    chapters: [
      { key: "c1", title: "Three locks, three jobs", at: 0 },
      { key: "c2", title: "Losing the device", at: 615 },
    ],
  },
  {
    key: "ep-07",
    title: "What the desk watches at open",
    author: "Amara O.",
    summary:
      "The first twenty minutes, from the inside: the numbers on the desk's screens, and which of them ever reach yours.",
    durationSec: 1440,
    progress: 0.18,
    chapters: [
      { key: "c1", title: "The first twenty minutes", at: 0 },
      { key: "c2", title: "What reaches you", at: 700 },
    ],
  },
  {
    key: "ep-06",
    title: "Stablecoins, plainly",
    author: "Zainab K.",
    summary:
      "What is holding the peg, who is holding the reserves, and the questions worth asking before you park a balance in one.",
    durationSec: 1050,
    chapters: [
      { key: "c1", title: "Holding the peg", at: 0 },
      { key: "c2", title: "Holding the reserves", at: 390 },
    ],
  },
  {
    key: "ep-05",
    title: "The week the market stopped",
    author: "Kelechi N.",
    summary:
      "A week of halted trading, told by the people who had positions open through it — and what it changed about how this desk sizes risk.",
    durationSec: 2020,
    chapters: [
      { key: "c1", title: "Monday", at: 0 },
      { key: "c2", title: "The halt", at: 640 },
      { key: "c3", title: "What changed after", at: 1505 },
    ],
  },
];

const byKey = new Map(catalog.map((episode) => [episode.key, episode]));

/** The record behind a `/podcast/[id]` route. Undefined for an unknown key. */
export function episodeById(key: string): PodcastEpisode | undefined {
  return byKey.get(key);
}

export const nowPlaying: MediaItem = {
  key: catalog[0].key,
  title: catalog[0].title,
  kicker: "Now playing.....",
  byline: `By ${catalog[0].author} 2023`,
  kind: "podcast",
  actionLabel: "Play now",
  artwork: catalog[0].artwork,
};

export const podcastTabs = ["Recent", "Topics", "Author", "Episodes"];

/** The grid's view of the catalogue — see the note at the top of this file. */
export const episodes: Episode[] = catalog.map((episode) => ({
  key: episode.key,
  title: episode.title,
  artwork: episode.artwork,
  progress: episode.progress,
  elapsed:
    episode.progress === undefined
      ? undefined
      : formatTime(episode.progress * episode.durationSec),
}));

export const authors: Author[] = [
  {
    key: "amara",
    name: "Amara O.",
    accentClassName: "border-brand",
    artwork: require("@/assets/images/authors/author_1.png"),
  },
  {
    key: "zainab",
    name: "Zainab K.",
    artwork: require("@/assets/images/authors/author_2.png"),
  },
  {
    key: "tobi",
    name: "Tobi A.",
    artwork: require("@/assets/images/authors/author_3.png"),
  },
  {
    key: "kelechi",
    name: "Kelechi N.",
    artwork: require("@/assets/images/authors/author_4.png"),
  },
  {
    key: "dami",
    name: "Dami F.",
    artwork: require("@/assets/images/authors/author_1.png"),
  },
];
