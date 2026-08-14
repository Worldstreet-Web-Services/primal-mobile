import type { BalanceStats, Position } from "@/components/trade";

/**
 * Copy-trading mock. Worldstreet owns the real endpoints (PRD §F6 — the major
 * dependency), so these shapes are the contract the UI expects: preformatted
 * amount strings, never JSON numbers, matching the engine's decimal-string
 * wire format.
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
  },
  {
    id: "btc-usdt-2",
    pair: "BTC/USDT",
    side: "short",
    changePct: "+12.4%",
    changeUsd: "+$200.69",
    trader: "Alex .R",
    entry: "+$200.69",
  },
  {
    id: "btc-usdt-3",
    pair: "BTC/USDT",
    side: "long",
    changePct: "+12.4%",
    changeUsd: "+$200.69",
    trader: "Alex .R",
    entry: "+$200.69",
  },
];

export const tradeFilters = ["All", "Long", "Short"] as const;
export type TradeFilter = (typeof tradeFilters)[number];
