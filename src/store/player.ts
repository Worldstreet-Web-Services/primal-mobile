import { create } from "zustand";

import { catalog, episodeById, type PodcastEpisode } from "@/data/podcast";

/**
 * The podcast transport.
 *
 * It lives in a store rather than on a screen because playback outlives the
 * screen that started it: minimise the player and it keeps running while you
 * move through the rest of the app, which is only possible if the state is not
 * owned by a route.
 *
 * WHAT THIS IS NOT: an audio engine. Nothing here decodes anything — the
 * position is advanced by a ticker off the wall clock, so the whole flow (the
 * scrubber, the chapter marks, the up-next hand-off, the mini bar) is real and
 * exercisable before there is a single media URL in the catalogue.
 *
 * SLOTTING IN REAL AUDIO: install `expo-audio`, create the player once at
 * module scope, and replace the four seams below — `startTicker`/`stopTicker`
 * become subscribe/unsubscribe on the player's status event, `applyPosition`
 * becomes `player.seekTo`, and `play()` additionally calls `player.replace()`.
 * Every component reads `positionSec` / `playing` and nothing else, so none of
 * them change.
 *
 * Position is derived from a wall-clock anchor rather than accumulated per
 * tick: JS timers stall when the app is backgrounded, and a counter that adds
 * up ticks would silently lose exactly the time the audio kept playing.
 */

/** How far the two seek controls jump. Podcast convention, not arbitrary. */
export const SEEK_BACK_SEC = 15;
export const SEEK_FORWARD_SEC = 30;

/** The rates the speed control cycles through. */
export const RATES = [1, 1.25, 1.5, 1.75, 2] as const;

export type RepeatMode = "off" | "all" | "one";

const TICK_MS = 250;

interface PlayerState {
  episode: PodcastEpisode | null;
  /** Ordered keys the transport moves through — the catalogue, by default. */
  queue: string[];
  /** Where `episode` sits in `queue`. -1 when nothing is loaded. */
  index: number;

  playing: boolean;
  positionSec: number;
  rate: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Full-screen player up, versus the docked mini bar. */
  expanded: boolean;
  /** True while a finger is on the scrubber — the ticker must not fight it. */
  scrubbing: boolean;

  /** Load an episode and start it, full screen. */
  play: (key: string, queue?: string[]) => void;
  toggle: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  skip: (delta: number) => void;
  /** Advance. False when there is nothing after the current episode. */
  next: () => boolean;
  setScrubbing: (scrubbing: boolean) => void;

  cycleRate: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  expand: () => void;
  minimize: () => void;
  /** Stop and unload — the mini bar goes away with it. */
  close: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => {
  let ticker: ReturnType<typeof setInterval> | null = null;
  /** Wall clock at the last position write, and the position it wrote. */
  let anchorMs = 0;
  let anchorPos = 0;

  /** Re-anchor so elapsed time is measured from now, at the current position. */
  const applyPosition = (seconds: number) => {
    anchorMs = Date.now();
    anchorPos = seconds;
    set({ positionSec: seconds });
  };

  const stopTicker = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };

  const startTicker = () => {
    stopTicker();
    anchorMs = Date.now();
    anchorPos = get().positionSec;
    ticker = setInterval(() => {
      const { episode, playing, rate, scrubbing } = get();
      if (!episode || !playing) return;
      // A drag owns the position while it lasts; writing over it here is what
      // makes a scrubber stutter back under the finger.
      if (scrubbing) {
        anchorMs = Date.now();
        anchorPos = get().positionSec;
        return;
      }

      const elapsed = ((Date.now() - anchorMs) / 1000) * rate;
      const at = anchorPos + elapsed;

      if (at >= episode.durationSec) {
        finish();
        return;
      }
      set({ positionSec: at });
    }, TICK_MS);
  };

  /** Ran to the end: repeat, advance, or stop at the last episode. */
  const finish = () => {
    const { repeat, episode } = get();
    if (!episode) return;

    if (repeat === "one") {
      applyPosition(0);
      return;
    }
    const moved = get().next();
    if (!moved) {
      // Nothing after this one. Park at the end, paused, rather than closing —
      // the bar stays put so "play" restarts what you were listening to.
      stopTicker();
      set({ playing: false, positionSec: episode.durationSec });
    }
  };

  /** Which key comes next, honouring shuffle and repeat. Null at the end. */
  const nextKey = (): string | null => {
    const { queue, index, shuffle, repeat } = get();
    if (queue.length === 0) return null;

    if (shuffle && queue.length > 1) {
      let pick = index;
      while (pick === index) pick = Math.floor(Math.random() * queue.length);
      return queue[pick];
    }
    if (index + 1 < queue.length) return queue[index + 1];
    return repeat === "all" ? queue[0] : null;
  };

  const loadKey = (
    key: string,
    queue: string[] | undefined,
    playing: boolean,
  ) => {
    const episode = episodeById(key);
    if (!episode) return false;

    const list = queue ?? get().queue;
    const index = list.indexOf(key);

    set({
      episode,
      queue: list,
      // A key outside the queue still plays; it just has nothing after it.
      index,
      playing,
      // Resume where the listening history left off, the way every podcast app
      // does — an episode you are 40% into does not restart because you tapped
      // it from the wall.
      positionSec: (episode.progress ?? 0) * episode.durationSec,
    });
    applyPosition(get().positionSec);
    if (playing) startTicker();
    else stopTicker();
    return true;
  };

  return {
    episode: null,
    queue: catalog.map((episode) => episode.key),
    index: -1,

    playing: false,
    positionSec: 0,
    rate: 1,
    shuffle: false,
    repeat: "off",
    expanded: false,
    scrubbing: false,

    play: (key, queue) => {
      if (loadKey(key, queue, true)) set({ expanded: true });
    },

    toggle: () => {
      const { episode, playing } = get();
      if (!episode) return;
      if (playing) {
        stopTicker();
        set({ playing: false });
        return;
      }
      // Pressing play at the very end restarts rather than doing nothing.
      if (get().positionSec >= episode.durationSec - 0.5) applyPosition(0);
      set({ playing: true });
      startTicker();
    },

    pause: () => {
      if (!get().playing) return;
      stopTicker();
      set({ playing: false });
    },

    seekTo: (seconds) => {
      const { episode } = get();
      if (!episode) return;
      applyPosition(Math.min(Math.max(seconds, 0), episode.durationSec));
    },

    skip: (delta) => get().seekTo(get().positionSec + delta),

    next: () => {
      const key = nextKey();
      if (!key) return false;
      return loadKey(key, undefined, true);
    },

    setScrubbing: (scrubbing) => {
      set({ scrubbing });
      // Landing the drag re-anchors, or the ticker would credit the whole drag
      // as elapsed playback on its next pass.
      if (!scrubbing) applyPosition(get().positionSec);
    },

    cycleRate: () => {
      const at = RATES.indexOf(get().rate as (typeof RATES)[number]);
      const rate = RATES[(at + 1) % RATES.length];
      // Re-anchor before the rate changes, so the seconds already elapsed are
      // banked at the old speed instead of being re-scaled by the new one.
      applyPosition(get().positionSec);
      set({ rate });
    },

    toggleShuffle: () => set({ shuffle: !get().shuffle }),

    cycleRepeat: () => {
      const order: RepeatMode[] = ["off", "all", "one"];
      const at = order.indexOf(get().repeat);
      set({ repeat: order[(at + 1) % order.length] });
    },

    expand: () => set({ expanded: true }),
    minimize: () => set({ expanded: false }),

    close: () => {
      stopTicker();
      set({
        episode: null,
        index: -1,
        playing: false,
        positionSec: 0,
        expanded: false,
        scrubbing: false,
      });
    },
  };
});
