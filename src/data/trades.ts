import type { BalanceStats, Candle, Position } from "@/components/trade";

/**
 * Copy-trading mock. Worldstreet owns the real endpoints (PRD §F6 — the major
 * dependency), so these shapes are the contract the UI expects: preformatted
 * amount strings, never JSON numbers, matching the engine's decimal-string
 * wire format.
 *
 * The one exception is `Candle`, which is numeric: a chart has to scale its own
 * series, so formatting happens at the axis instead.
 */

export const tradingBalance: BalanceStats = {
  total: "$10,383.42",
  currency: "USD",
  gain: "+$3,204.18",
  gainPct: "+6.9%",
  period: "this month",
  live: true,
};

export const openPositions: Position[] = [
  {
    id: "btc-usdt-1",
    pair: "BTC/USDT",
    side: "long",
    changePct: "+12.4%",
    changeUsd: "+$200.69",
    trader: "Alex .R",
    entry: "+$200.69",
    duration: "3h 24m",
    copying: true,
  },
  {
    id: "btc-usdt-2",
    pair: "BTC/USDT",
    side: "short",
    changePct: "+12.4%",
    changeUsd: "+$200.69",
    trader: "Alex .R",
    entry: "+$200.69",
    duration: "3h 24m",
  },
  {
    id: "btc-usdt-3",
    pair: "BTC/USDT",
    side: "short",
    changePct: "+12.4%",
    changeUsd: "+$200.69",
    trader: "Alex .R",
    entry: "+$200.69",
    duration: "3h 24m",
  },
  {
    id: "btc-usdt-4",
    pair: "BTC/USDT",
    side: "long",
    changePct: "+12.4%",
    changeUsd: "+$200.69",
    trader: "Alex .R",
    entry: "+$200.69",
    duration: "3h 24m",
  },
];

export const tradeFilters = ["All", "Long", "Short"] as const;
export type TradeFilter = (typeof tradeFilters)[number];

/** Ranges the detail chart can be cut to. Index 3 ("1D") is the default view. */
export const chartRanges = ["1H", "2H", "8H", "1D", "1W", "1M", "1Y"] as const;

/** Placeholder series — one bar per hour, standing in for the feed. */
const CANDLES: Candle[] = [
  { o: 91800, h: 92600, l: 91200, c: 92400, v: 32 },
  { o: 92400, h: 93100, l: 92000, c: 92700, v: 41 },
  { o: 92700, h: 93400, l: 92300, c: 92500, v: 28 },
  { o: 92500, h: 94200, l: 92400, c: 94000, v: 55 },
  { o: 94000, h: 94600, l: 93400, c: 93700, v: 37 },
  { o: 93700, h: 95300, l: 93600, c: 95100, v: 62 },
  { o: 95100, h: 95800, l: 94600, c: 94900, v: 34 },
  { o: 94900, h: 96900, l: 94800, c: 96600, v: 71 },
  { o: 96600, h: 97400, l: 96100, c: 96400, v: 39 },
  { o: 96400, h: 98300, l: 96300, c: 98100, v: 66 },
  { o: 98100, h: 98900, l: 97600, c: 97900, v: 44 },
  { o: 97900, h: 99800, l: 97800, c: 99600, v: 78 },
  { o: 99600, h: 100400, l: 99100, c: 99400, v: 42 },
  { o: 99400, h: 101300, l: 99300, c: 101100, v: 83 },
  { o: 101100, h: 101900, l: 100600, c: 100900, v: 47 },
  { o: 100900, h: 102900, l: 100800, c: 102580, v: 91 },
];

const TIMES = ["16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

export interface TradeDetail {
  position: Position;
  candles: Candle[];
  /** X-axis labels for `candles`. */
  times: string[];
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  timeOpen: string;
}

/**
 * One position's detail sheet. Returns `undefined` for an unknown id so the
 * route can show its own not-found state rather than rendering half a screen.
 */
export function tradeDetail(id: string): TradeDetail | undefined {
  const position = openPositions.find((p) => p.id === id);
  if (!position) return undefined;

  return {
    position,
    candles: CANDLES,
    times: TIMES,
    entryPrice: "$91,240",
    currentPrice: "$102,580",
    pnl: `+$11,340 (${position.changePct})`,
    timeOpen: position.duration ?? "—",
  };
}
