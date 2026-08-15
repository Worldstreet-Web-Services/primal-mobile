// USD pricing by symbol — Alchemy's by-symbol Prices API (the source Ark's
// price store falls back to when the wsws host is down), over a static map.

const KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ?? "";
const TIMEOUT_MS = 10_000;

/**
 * STATIC FALLBACK PRICES — hand-refreshed snapshot so holdings still value
 * when the price API is unreachable. Never live-accurate; the live fetch
 * overwrites every symbol it can price. (Snapshot 2026-08-15.)
 */
export const STATIC_PRICES_USD: Record<string, number> = {
  ETH: 3164.52,
  SOL: 135.97,
  POL: 0.23,
  USDC: 1,
  USDT: 1,
  DAI: 1,
};

/** Static demo FX until primal-be quotes it — mirrors the mock's ₦/$ ratio. */
export const USD_NGN = 1537;

/**
 * Price the given symbols in USD. Starts from the static map and overlays
 * whatever the live API returns, so a partial or failed fetch degrades to
 * stale-but-plausible values instead of $0 rows.
 */
export async function fetchPricesUsd(
  symbols: string[],
): Promise<Record<string, number>> {
  const uniq = [...new Set(symbols)];
  const out: Record<string, number> = {};
  for (const s of uniq) {
    if (STATIC_PRICES_USD[s] != null) out[s] = STATIC_PRICES_USD[s];
  }
  if (!KEY || uniq.length === 0) return out;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const qs = uniq.map((s) => `symbols=${encodeURIComponent(s)}`).join("&");
    const res = await fetch(
      `https://api.g.alchemy.com/prices/v1/${KEY}/tokens/by-symbol?${qs}`,
      { signal: controller.signal },
    );
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as {
      data?: { symbol: string; prices: { value: string }[] }[];
    };
    for (const d of body.data ?? []) {
      const v = Number(d.prices?.[0]?.value);
      if (Number.isFinite(v)) out[d.symbol] = v;
    }
  } catch {
    // The static map stands.
  } finally {
    clearTimeout(timer);
  }
  return out;
}
