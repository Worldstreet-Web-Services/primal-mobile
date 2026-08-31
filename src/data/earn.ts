import type { Asset, Quote } from "@/components/earn";
import type { BalanceStats } from "@/components/trade";

/**
 * Auto-earn mock (PRD §F7). Kash is Worldstreet's rewards token: points accrue
 * live and settle to KSH every Saturday 00:00 UTC. Amounts stay strings — the
 * rewards engine rejects JSON numbers and caps at 6 decimal places.
 */

// No `live`/`status`: the earn balance settles weekly rather than ticking, so
// there is no market state to report and the card leads straight with the move.
export const earnPortfolio: BalanceStats = {
  total: "$10,383.42",
  currency: "USD",
  gain: "+$3,204.18",
  gainPct: "+6.9%",
  period: "this month",
};

export const kashQuote: Quote = {
  symbol: "KASH",
  price: "$989.09",
  delta: "+2.4%",
};

/** Closing values for the selected range, oldest first. */
export const kashSeries = [
  18, 20, 19, 24, 23, 28, 27, 31, 30, 36, 34, 33, 39, 38, 44, 42, 48, 47, 52,
  50, 57, 55, 61, 60, 66, 64, 70, 69, 75, 73, 79, 78, 84, 82, 88, 92, 90, 96,
];

export const ranges = ["1W", "1M", "1Y", "ALL"];
export const defaultRange = 1;

/** The watch line under the chart. */
export const kashHolding: Asset[] = [
  { key: "kash", name: "Kash", sub: "Kash", value: "$989.09", delta: "+2.4%" },
];

export const portfolio: Asset[] = [
  {
    key: "kash-3m",
    name: "Kash",
    sub: "3 Months",
    value: "$988.20",
    delta: "+2.4%",
  },
  {
    key: "kash-6m",
    name: "Kash",
    sub: "6 Months",
    value: "$8,412.00",
    delta: "+2.4%",
  },
  {
    key: "kash-1y",
    name: "Kash",
    sub: "1 Year",
    value: "$1,204.18",
    delta: "+6.9%",
  },
];

/**
 * The Auto Earn deposit form (PRD §F7).
 *
 * The rate is QUOTED, not derived — the yield engine publishes it and the
 * screen only multiplies the entered amount by it, so a rate change is one edit
 * here rather than a formula scattered across the view.
 */
export const autoEarn = {
  /** Spendable balance the deposit is drawn from — what `Max` and 100% mean. */
  available: 1500,
  /** Current variable rate, as a percentage per year. */
  apy: 12.4,
  /** How that rate has moved over the last week, already signed. */
  apyDelta: "+0.85% this week",
};
