import { AppState, type AppStateStatus } from "react-native";
import { create } from "zustand";

import { appIsActive } from "@/lib/appActive";
import {
  fetchVaultActivities,
  fetchVaultGames,
  fetchVaultWinners,
  type VaultActivity,
  type VaultGame,
  VAULT_WS_URL,
  type VaultWinner,
} from "@/lib/vault/api";
import { firstUnitUsd, moneyFromWei, weiToUsd } from "@/lib/vault/format";

// Live state for the King of Night vault (v4 — MANY concurrent games, each
// with its own gameId, pot, countdown and king). The WebSocket hub is the
// primary feed (topic vault:king-of-night); REST bootstraps and is the
// fallback poll while disconnected. Mobile-driven choices:
//   1. Countdowns anchor to each game's on-chain endTime (wall-clock ms) —
//      JS timers freeze in the background, wall-clock math survives it.
//   2. The socket follows AppState: closed in background, reconnected +
//      resynced on foreground.
//   3. The gateway indexes chain logs and trails the chain by confirmation
//      depth, so a confirmed local action overlays the lobby immediately
//      (overlayGame) and stale snapshots are ignored until the indexer
//      catches up. A game's endTime only ever moves forward, which makes the
//      merge a monotonic comparison instead of a guard flag.

const TOPIC = "vault:king-of-night";
const PING_MS = 25_000;
const RECONNECT_MS = 2_000;
const FALLBACK_POLL_MS = 15_000;
const FEED_POLL_MS = 30_000;
/** Frames carry the delta, not the feed rows — one debounced REST read
 * refreshes both feeds after a burst (the indexer needs a beat anyway). */
const FEED_DEBOUNCE_MS = 2_000;
const REVEAL_AUTO_CLOSE_MS = 12_000;
const MAX_ACTIVITIES = 30;
/** How long a chain-truth overlay outranks the indexer before we trust REST
 * again unconditionally. */
const OVERLAY_GRACE_MS = 30_000;
// Expiry watchdog: how long past a deadline to wait before asking, how often
// to re-ask, and how many asks before handing off to the slow fallback poll.
const EXPIRY_GRACE_MS = 1_500;
const EXPIRY_POLL_MS = 2_500;
const EXPIRY_POLL_MAX = 12;

export type RoundPhase =
  | { kind: "idle" }
  | { kind: "calculating"; gameId: number; potUsd: number }
  | { kind: "reveal"; gameId: number; winner: string; prizeUsd: number };

/** The game the big pot/countdown shows: the user's pick while it is still
 * live, otherwise the richest active pot. */
export function featuredGame(
  games: VaultGame[],
  featuredId: number | null,
): VaultGame | null {
  const actives = games.filter((g) => g.active && !g.settled);
  if (featuredId !== null) {
    const chosen = actives.find((g) => g.gameId === featuredId);
    if (chosen) return chosen;
  }
  let best: VaultGame | null = null;
  for (const g of actives) {
    if (!best || g.pot.usdValue > best.pot.usdValue) best = g;
  }
  return best;
}

interface VaultState {
  /** The lobby, newest first. Settled games drop out on the next snapshot. */
  games: VaultGame[];
  connected: boolean;
  loading: boolean;
  error: boolean;
  activities: VaultActivity[];
  winners: VaultWinner[];
  /** User-selected stage game; null lets the richest pot take the stage. */
  featuredId: number | null;
  phase: RoundPhase;

  /** Begin the socket + bootstrap. Safe to call repeatedly. */
  start: () => void;
  /** Tear down socket/timers (screen unmounted). */
  stop: () => void;
  refresh: () => Promise<void>;
  selectGame: (gameId: number | null) => void;
  /**
   * A game state read straight from the CONTRACT after this user's confirmed
   * action. The indexer lags the chain by several seconds, so without this
   * the lobby keeps showing the old round — timer not reset, the join
   * re-armed — and users double-pay. Outranks polled rows until the indexer
   * catches up (same endTime) or the grace window expires.
   */
  overlayGame: (game: VaultGame) => void;
  dismissReveal: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => {
  let ws: WebSocket | null = null;
  let started = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let feedPollTimer: ReturnType<typeof setInterval> | null = null;
  let feedDebounce: ReturnType<typeof setTimeout> | null = null;
  let revealTimer: ReturnType<typeof setTimeout> | null = null;
  let appStateSub: { remove: () => void } | null = null;
  /** Chain-truth rows that outrank the indexer; see overlayGame. */
  const overlays = new Map<number, { game: VaultGame; until: number }>();
  /** The live expiry watch, or null. `cancel` kills a loop already in flight. */
  interface ExpiryWatch {
    cancel: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  }
  let expiryWatch: ExpiryWatch | null = null;

  /** ETH/USD from whatever the gateway last priced — pots, wagers, prizes. */
  const unit = () =>
    firstUnitUsd([
      ...get().games.flatMap((g) => [g.pot, g.minWager]),
      ...get().winners.flatMap((w) => [w.toWinner, w.pot]),
    ]);

  const stopExpiryWatch = () => {
    if (!expiryWatch) return;
    expiryWatch.cancel = true;
    if (expiryWatch.timer) clearTimeout(expiryWatch.timer);
    expiryWatch = null;
  };

  const mergeLobby = (incoming: VaultGame[]): VaultGame[] => {
    const now = Date.now();
    for (const [id, o] of [...overlays]) if (now > o.until) overlays.delete(id);
    const byId = new Map(incoming.map((g) => [g.gameId, g] as const));
    for (const [id, o] of overlays) {
      const inc = byId.get(id);
      // The chain read is truth at its moment; the indexer's row wins back
      // its seat when it reaches the same endTime (endTime never regresses
      // within a game) or reports the settlement.
      if (!inc || (!inc.settled && inc.endTime < o.game.endTime)) {
        byId.set(id, o.game);
      } else {
        overlays.delete(id);
      }
    }
    return [...byId.values()].sort((a, b) => b.gameId - a.gameId);
  };

  const applyGames = (incoming: VaultGame[]) => {
    const games = mergeLobby(incoming);
    set({ games, loading: false, error: false });
    if (games.some((g) => g.active && !g.settled)) watchExpiry();
    // The staged game settled without a frame (missed edge, keeper raced the
    // socket): resolve the reveal from the winners feed instead of leaving
    // the suspense overlay up forever.
    const ph = get().phase;
    if (ph.kind === "calculating") {
      const g = games.find((x) => x.gameId === ph.gameId);
      if (!g || g.settled || !g.active) resolveReveal(ph.gameId);
    }
  };

  const scheduleRevealClose = () => {
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(
      () => set({ phase: { kind: "idle" } }),
      REVEAL_AUTO_CLOSE_MS,
    );
  };

  /** Turn a "calculating" hold into a reveal from the winners feed. */
  const resolveReveal = (gameId: number) => {
    void fetchVaultWinners()
      .then((winners) => {
        set({ winners });
        const ph = get().phase;
        if (ph.kind !== "calculating" || ph.gameId !== gameId) return;
        const w = winners.find((x) => x.gameId === gameId);
        if (w) {
          set({
            phase: {
              kind: "reveal",
              gameId,
              winner: w.winner,
              prizeUsd: w.toWinner.usdValue,
            },
          });
          scheduleRevealClose();
        }
        // Not indexed yet — the expiry watchdog keeps asking within its
        // budget, and its exhaustion path clears the hold.
      })
      .catch(() => {});
  };

  /**
   * Re-ask the server once the nearest deadline runs out.
   *
   * The hub pushes frames when someone PLAYS; a game that expires quietly
   * waits on a keeper's settle() and may send nothing for a while. Meanwhile
   * the fallback poll only runs while the socket is down — so a healthy
   * socket would leave the stage frozen at 00:00 with a stale "active" game.
   * This loop sleeps until the earliest active deadline (re-reading it each
   * tick, so a wager at the buzzer reschedules instead of spending the
   * attempt budget), then polls the lobby until the expired game settles or
   * drops. Bounded; past the cap the slow fallback poll still exists.
   */
  const watchExpiry = () => {
    if (expiryWatch) return; // one loop is enough; it re-reads state each tick
    const token: ExpiryWatch = { cancel: false, timer: null };
    expiryWatch = token;
    let attempts = 0;

    const schedule = (ms: number) => {
      token.timer = setTimeout(tick, ms);
    };
    const nearestDeadline = () => {
      const actives = get().games.filter((g) => g.active && !g.settled);
      return actives.length
        ? Math.min(...actives.map((g) => g.endTime * 1000))
        : null;
    };
    const tick = () => {
      if (token.cancel || !started) return;
      const nearest = nearestDeadline();
      if (nearest === null) {
        stopExpiryWatch();
        return;
      }
      const now = Date.now();
      if (nearest > now) {
        attempts = 0; // clocks moved (someone played) — fresh budget
        schedule(nearest - now + EXPIRY_GRACE_MS);
        return;
      }
      // A game is past its deadline. If it is the one on stage, open the
      // suspense window while the keeper settles it.
      const feat = featuredGame(get().games, get().featuredId);
      if (
        feat &&
        feat.endTime * 1000 <= now &&
        get().phase.kind === "idle"
      ) {
        set({
          phase: {
            kind: "calculating",
            gameId: feat.gameId,
            potUsd: feat.pot.usdValue,
          },
        });
      }
      if (attempts++ >= EXPIRY_POLL_MAX) {
        // Don't strand the suspense overlay on a keeper that never came.
        if (get().phase.kind === "calculating") set({ phase: { kind: "idle" } });
        stopExpiryWatch();
        return;
      }
      fetchVaultGames()
        .then(applyGames)
        .catch(() => {})
        .finally(() => {
          if (!token.cancel) schedule(EXPIRY_POLL_MS);
        });
    };

    const nearest = nearestDeadline();
    schedule(Math.max(0, (nearest ?? Date.now()) - Date.now()) + EXPIRY_GRACE_MS);
  };

  const scheduleFeedRefresh = () => {
    if (feedDebounce) return;
    feedDebounce = setTimeout(() => {
      feedDebounce = null;
      void fetchVaultActivities()
        .then((activities) =>
          set({ activities: activities.slice(0, MAX_ACTIVITIES) }),
        )
        .catch(() => {});
      void fetchVaultWinners()
        .then((winners) => set({ winners }))
        .catch(() => {});
    }, FEED_DEBOUNCE_MS);
  };

  const handleFrame = (raw: string) => {
    let frame: { type?: string; data?: unknown };
    try {
      frame = JSON.parse(raw);
    } catch {
      return;
    }
    switch (frame.type) {
      case "activeGames": {
        const games = (frame.data as { games?: VaultGame[] })?.games;
        if (Array.isArray(games)) applyGames(games);
        break;
      }
      case "gameStarted": {
        const d = frame.data as {
          gameId?: number;
          starter?: string;
          minWagerWei?: string;
          potWei?: string;
          endTime?: number;
        };
        if (d?.gameId === undefined || !d.starter) break;
        const u = unit();
        const endTime = Number(d.endTime ?? 0);
        const game: VaultGame = {
          gameId: Number(d.gameId),
          starter: d.starter,
          king: d.starter, // the starter opens as king
          pot: moneyFromWei(d.potWei ?? d.minWagerWei ?? "0", u),
          minWager: moneyFromWei(d.minWagerWei ?? "0", u),
          endTime,
          timeRemaining: Math.max(0, endTime - Math.floor(Date.now() / 1000)),
          settled: false,
          active: true,
        };
        applyGames([
          ...get().games.filter((g) => g.gameId !== game.gameId),
          game,
        ]);
        scheduleFeedRefresh();
        break;
      }
      case "wagerPlaced": {
        const d = frame.data as {
          gameId?: number;
          player?: string;
          newPotWei?: string;
          newEndTime?: number;
        };
        if (d?.gameId === undefined) break;
        const gameId = Number(d.gameId);
        if (!get().games.some((g) => g.gameId === gameId)) {
          // A play on a game we've never seen — resync the lobby.
          void fetchVaultGames().then(applyGames).catch(() => {});
          break;
        }
        const u = unit();
        applyGames(
          get().games.map((g) =>
            g.gameId !== gameId
              ? g
              : {
                  ...g,
                  king: d.player ?? g.king,
                  pot: d.newPotWei ? moneyFromWei(d.newPotWei, u) : g.pot,
                  endTime: Number(d.newEndTime ?? g.endTime),
                },
          ),
        );
        scheduleFeedRefresh();
        break;
      }
      case "gameSettled": {
        const d = frame.data as {
          gameId?: number;
          winner?: string;
          toWinnerWei?: string;
          toWinner?: string;
        };
        if (d?.gameId === undefined || !d.winner) break;
        const gameId = Number(d.gameId);
        const game = get().games.find((g) => g.gameId === gameId);
        const wei = d.toWinnerWei ?? d.toWinner;
        // Prefer the frame's exact split; fall back to the winner's 50%.
        const prizeUsd = wei
          ? weiToUsd(String(wei), unit())
          : (game?.pot.usdValue ?? 0) * 0.5;
        const ph = get().phase;
        const feat = featuredGame(get().games, get().featuredId);
        // Reveal only for the game on stage — a lobby of parallel games must
        // not interrupt the one the user is watching.
        if (
          feat?.gameId === gameId ||
          (ph.kind === "calculating" && ph.gameId === gameId)
        ) {
          set({
            phase: { kind: "reveal", gameId, winner: d.winner, prizeUsd },
          });
          scheduleRevealClose();
        }
        overlays.delete(gameId);
        applyGames(
          get().games.map((g) =>
            g.gameId === gameId ? { ...g, settled: true, active: false } : g,
          ),
        );
        scheduleFeedRefresh();
        break;
      }
      default:
        break; // welcome/subscribed/pong/error acks
    }
  };

  const connect = () => {
    if (!started || ws || !VAULT_WS_URL) return;
    try {
      ws = new WebSocket(VAULT_WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      set({ connected: true });
      ws?.send(JSON.stringify({ type: "subscribe", topics: [TOPIC] }));
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(
        () => ws?.send(JSON.stringify({ type: "ping" })),
        PING_MS,
      );
      // The hub never replays state on subscribe — resync over REST.
      void get().refresh();
    };
    ws.onmessage = (e) => handleFrame(String(e.data));
    ws.onerror = () => {};
    ws.onclose = () => {
      set({ connected: false });
      cleanupSocket();
      scheduleReconnect();
    };
  };

  const cleanupSocket = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    ws = null;
  };

  const scheduleReconnect = () => {
    if (!started) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, RECONNECT_MS);
  };

  const disconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (ws) {
      const socket = ws;
      ws = null; // prevent onclose from reconnecting
      socket.onclose = null;
      try {
        socket.close();
      } catch {}
    }
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    set({ connected: false });
  };

  const onAppStateChange = (state: AppStateStatus) => {
    if (!started) return;
    if (state === "active") {
      connect();
      void get().refresh();
    } else if (state === "background") {
      disconnect();
    }
  };

  return {
    games: [],
    connected: false,
    loading: true,
    error: false,
    activities: [],
    winners: [],
    featuredId: null,
    phase: { kind: "idle" },

    start: () => {
      if (started) return;
      started = true;
      appStateSub = AppState.addEventListener("change", onAppStateChange);
      connect();
      void get().refresh();
      // Fallback polling — only does work while the socket is down. Skipped
      // while backgrounded too (Android keeps firing timers, and background
      // is exactly when the socket is down): onAppStateChange already
      // reconnects and refreshes on foreground.
      pollTimer = setInterval(() => {
        if (!appIsActive()) return;
        if (!get().connected) {
          void fetchVaultGames()
            .then(applyGames)
            .catch(() => set({ error: true }));
        }
      }, FALLBACK_POLL_MS);
      feedPollTimer = setInterval(() => {
        if (!appIsActive()) return;
        if (!get().connected) {
          void fetchVaultActivities()
            .then((activities) =>
              set({ activities: activities.slice(0, MAX_ACTIVITIES) }),
            )
            .catch(() => {});
          void fetchVaultWinners().then((winners) => set({ winners })).catch(() => {});
        }
      }, FEED_POLL_MS);
    },

    stop: () => {
      started = false;
      appStateSub?.remove();
      appStateSub = null;
      disconnect();
      stopExpiryWatch();
      for (const t of [pollTimer, feedPollTimer]) if (t) clearInterval(t);
      pollTimer = feedPollTimer = null;
      for (const t of [feedDebounce, revealTimer]) if (t) clearTimeout(t);
      feedDebounce = revealTimer = null;
    },

    refresh: async () => {
      try {
        const [games, activities, winners] = await Promise.all([
          fetchVaultGames(),
          fetchVaultActivities(),
          fetchVaultWinners(),
        ]);
        // Winners land before the lobby so unit pricing sees them.
        set({ activities: activities.slice(0, MAX_ACTIVITIES), winners });
        applyGames(games);
      } catch {
        set({ error: true, loading: false });
      }
    },

    selectGame: (gameId) => set({ featuredId: gameId }),

    overlayGame: (game) => {
      overlays.set(game.gameId, {
        game,
        until: Date.now() + OVERLAY_GRACE_MS,
      });
      applyGames(get().games); // the merge seats the overlay
    },

    dismissReveal: () => {
      if (revealTimer) clearTimeout(revealTimer);
      revealTimer = null;
      set({ phase: { kind: "idle" } });
    },
  };
});
