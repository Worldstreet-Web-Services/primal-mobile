import type { ImageSource } from "expo-image";

/**
 * Copy-trading leaderboard mock. Worldstreet owns the real endpoints (PRD §F6 —
 * the major dependency), so these shapes are the contract the UI expects:
 * preformatted strings, never JSON numbers, matching the engine's decimal-string
 * wire format. Nothing here is computed on the client.
 */
/**
 * The figures on a leader's profile. Preformatted for the same reason as
 * everything else in this file — the profile screen states them, it never
 * computes them.
 */
export interface TraderStats {
  /** What the leader runs, e.g. "$2.3M". */
  portfolioSize: string;
  /** How many members mirror them right now, e.g. "847". */
  activeCopiers: string;
  /** What those members have mirrored, e.g. "$1.2M". */
  copiedAssets: string;
  winRate: string;
  /** How long an average position stays open, e.g. "4.2h". */
  avgDuration: string;
  /** Worst peak-to-trough, signed: "-8.3%". */
  maxDrawdown: string;
  totalTrades: string;
}

export interface Trader {
  id: string;
  name: string;
  /**
   * Portrait. Deliberately absent for now — the client is supplying the art,
   * and `Avatar` draws the initial on a disc until it arrives. Drop an image in
   * with `avatar: require("@/assets/images/traders/alpha-algo.png")` and nothing
   * else has to change.
   */
  avatar?: ImageSource | number;
  /** Preformatted return, e.g. "+142.8%". The UI never does the math. */
  roi: string;
  /** The window the return is measured over — shown as "ROI (12M)". */
  roiPeriod?: string;
  /** How many members mirror this leader, preformatted: "1,842 copiers". */
  copiers?: string;
  /** Out of five, preformatted: "4.9". */
  rating?: string;
  /** What they trade — Forex, Crypto, Stocks. */
  market?: string;
  /** Trending right now — the red flag on the featured cards. */
  hot?: boolean;
  /** Currently in the market, drawn as the dot on the portrait. */
  online?: boolean;
  /** The member already mirrors this leader. */
  copying?: boolean;
  /** Profile figures. Absent until the leader's page has been sourced — see
      `traderStats`, which fills the gap rather than leaving a page half-drawn. */
  stats?: TraderStats;
}

/** The rail at the top: who is running hot, biggest first. */
export const featuredTraders: Trader[] = [
  {
    id: "alpha-algo",
    name: "AlphaAlgo",
    copiers: "1,842 copiers",
    roi: "+142.8%",
    roiPeriod: "12M",
    rating: "4.9",
    market: "Crypto",
    hot: true,
    online: true,
    stats: {
      portfolioSize: "$2.3M",
      activeCopiers: "847",
      copiedAssets: "$1.2M",
      winRate: "74%",
      avgDuration: "4.2h",
      maxDrawdown: "-8.3%",
      totalTrades: "1,847",
    },
  },
  {
    id: "satoshi-bull",
    name: "SatoshiBull",
    copiers: "940 copiers",
    roi: "+98.4%",
    roiPeriod: "12M",
    rating: "4.8",
    market: "Crypto",
    hot: true,
    online: true,
    stats: {
      portfolioSize: "$1.4M",
      activeCopiers: "512",
      copiedAssets: "$680K",
      winRate: "69%",
      avgDuration: "6.1h",
      maxDrawdown: "-11.2%",
      totalTrades: "1,204",
    },
  },
  {
    id: "eth-master",
    name: "EthMaster",
    copiers: "2,310 copiers",
    roi: "+76.2%",
    roiPeriod: "12M",
    rating: "4.7",
    market: "Crypto",
    hot: true,
    stats: {
      portfolioSize: "$3.1M",
      activeCopiers: "1,309",
      copiedAssets: "$2.0M",
      winRate: "66%",
      avgDuration: "9.4h",
      maxDrawdown: "-14.0%",
      totalTrades: "2,633",
    },
  },
];

/** The ranked list under the rail. */
export const rankedTraders: Trader[] = [
  {
    id: "wave-rider",
    name: "WaveRider",
    roi: "+64.21%",
    roiPeriod: "12M",
    rating: "4.9",
    market: "Forex",
    online: true,
  },
  {
    id: "nova-trades",
    name: "NovaTrades",
    roi: "+53.10%",
    roiPeriod: "12M",
    rating: "4.8",
    market: "Crypto",
    online: true,
  },
  {
    id: "trend-master",
    name: "TrendMaster",
    roi: "+41.77%",
    roiPeriod: "12M",
    rating: "4.7",
    market: "Stocks",
    online: true,
  },
  {
    id: "quant-edge",
    name: "QuantEdge",
    roi: "+38.94%",
    roiPeriod: "12M",
    rating: "4.7",
    market: "Stocks",
    online: true,
  },
  {
    id: "pip-hunter",
    name: "PipHunter",
    roi: "+35.60%",
    roiPeriod: "12M",
    rating: "4.6",
    market: "Forex",
    online: true,
    copying: true,
  },
  {
    id: "liquidity-lab",
    name: "LiquidityLab",
    roi: "+31.08%",
    roiPeriod: "12M",
    rating: "4.6",
    market: "Crypto",
  },
  {
    id: "swing-sentinel",
    name: "SwingSentinel",
    roi: "+27.45%",
    roiPeriod: "12M",
    rating: "4.5",
    market: "Indices",
    online: true,
  },
  {
    id: "delta-hedge",
    name: "DeltaHedge",
    roi: "+24.82%",
    roiPeriod: "12M",
    rating: "4.5",
    market: "Commodities",
    copying: true,
  },
  {
    id: "candle-craft",
    name: "CandleCraft",
    roi: "+21.30%",
    roiPeriod: "12M",
    rating: "4.4",
    market: "Crypto",
    online: true,
  },
  {
    id: "steady-gains",
    name: "SteadyGains",
    roi: "+18.66%",
    roiPeriod: "12M",
    rating: "4.3",
    market: "Stocks",
  },
];

/**
 * The trading wallet, as the reference states it. Preformatted for the same
 * reason as everything else here: there is no KashPlus balance behind copy
 * trading yet, so this is placeholder copy and not a figure the app vouches for.
 */
export const copyTradingPortfolio = {
  label: "Trading Portfolio",
  amount: "$2,543.60",
};

/** How many leaders the member currently mirrors. */
export const copyPositionCount = 2;

/**
 * One leader by id, for the profile route. Returns `undefined` for an unknown
 * id so the screen can show its own not-found state rather than half a page.
 */
export function traderById(id: string): Trader | undefined {
  return [...featuredTraders, ...rankedTraders].find((t) => t.id === id);
}

/**
 * The figures a leader's profile falls back to.
 *
 * Every leader on the ranked list is a placeholder — Worldstreet owns the real
 * numbers — so rather than render a profile with four blanks in it, an unsourced
 * leader borrows this set. When the endpoint lands, `stats` arrives populated
 * per leader and this becomes dead weight to delete.
 */
export const placeholderTraderStats: TraderStats = {
  portfolioSize: "$860K",
  activeCopiers: "214",
  copiedAssets: "$410K",
  winRate: "62%",
  avgDuration: "7.8h",
  maxDrawdown: "-12.6%",
  totalTrades: "938",
};

/** One leader's profile figures, sourced or borrowed. */
export function traderStats(trader: Trader): TraderStats {
  return trader.stats ?? placeholderTraderStats;
}

/** The one-tap stakes on the profile, smallest first. */
export const investPresets = [25, 50, 100, 250, 500] as const;

/** Where the amount field starts — the middle preset. */
export const defaultInvestment = 50;

/**
 * The safety stop, as a share of the stake: mirroring is halted once the
 * position has given back this much. A fifth is what the reference states
 * ($10 under a $50 stake) and it is the only arithmetic on the screen — the
 * member is choosing the stake here, so the floor under it has to move with it.
 */
export const safetyStopRatio = 0.2;
