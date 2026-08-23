import type { Money } from "./api";

/** "0x1234…abcd" — the UI never shows a full address. */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Wei string → ETH number. Display-only precision. */
export function weiToEth(wei: string): number {
  try {
    return Number(BigInt(wei)) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * USD per ETH derived from any Money quote the gateway already priced.
 * Keeps the app free of any price-feed dependency.
 */
export function unitUsd(money: Money | null | undefined): number {
  if (!money) return 0;
  const eth = parseFloat(money.amount);
  if (!eth || !isFinite(eth)) return 0;
  return money.usdValue / eth;
}

/** First priceable quote in a pile of Money — pots, min wagers and prizes
 * all carry the same ETH/USD rate. */
export function firstUnitUsd(moneys: (Money | null | undefined)[]): number {
  for (const m of moneys) {
    const u = unitUsd(m);
    if (u > 0) return u;
  }
  return 0;
}

export function formatUsd(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function weiToUsd(wei: string, usdPerEth: number): number {
  return weiToEth(wei) * usdPerEth;
}

/** Build a renderable Money from a raw wei figure and the gateway's quote.
 * usdPerEth 0 (no quote yet) prices it at $0 — display-only, never spent. */
export function moneyFromWei(wei: string, usdPerEth: number): Money {
  const eth = weiToEth(wei);
  const usd = eth * usdPerEth;
  return {
    amount: String(eth),
    tokenSymbol: "ETH",
    usdValue: usd,
    formattedUsd: formatUsd(usd),
  };
}

/**
 * Product floor for games started from KashPlus. The starter's stake becomes
 * that game's minWager for every joiner, so a $50 start makes it a $50 game
 * for everyone. The contract-global minStartStake floor (~$0.37 today) is
 * Worldstreet's config, not ours — joining an EXTERNAL game floors at that
 * game's own minWager, shown honestly.
 */
export const PLAY_TARGET_USD = 50;

/** USD → wei at the gateway's quote. Computed in micro-ETH so the float
 * stays integer-safe, ceiled so rounding can never undershoot the floor. */
export function usdToWei(usd: number, usdPerEth: number): bigint {
  if (!(usdPerEth > 0)) return 0n;
  return BigInt(Math.ceil((usd / usdPerEth) * 1e6)) * 1_000_000_000_000n;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** mm:ss for the countdown. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}
