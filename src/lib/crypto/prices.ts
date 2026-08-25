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

/**
 * There is deliberately NO NGN/USD rate in this app.
 *
 * `USD_NGN = 1537` lived here, described by its own comment as "static demo FX
 * until the gateway quotes it". Its single consumer rendered `total * USD_NGN`
 * under the real crypto balance on the crypto space, in the same quiet money
 * type as a read figure — so a hand-typed constant was presented to members as
 * their holdings in naira, wrong by whatever the market had done since someone
 * typed it.
 *
 * The gateway quotes no rate: `/v1/auth/*`, `/v1/linkpay/*` and
 * `/v1/subscriptions/*` are the entire surface. Until one exists, cross-currency
 * conversion is not something this app can do, and a placeholder constant is not
 * a substitute — see `portfolioView` in `src/app/home.tsx`, which refuses to sum
 * naira and crypto at all rather than reach for a number nobody stands behind.
 *
 * If you are here because you want a naira equivalent: ask the backend for a
 * quoted, dated rate. Do not reintroduce this.
 */

/**
 * What a pricing pass produced, and how much of it the market actually said.
 *
 * `live` names the symbols the API answered for THIS call. Everything else in
 * `prices` is the hand-refreshed static snapshot — present so a failed fetch
 * degrades to stale-but-plausible values instead of $0 rows, but "stale but
 * plausible" is precisely what a screen must not present as a quote. Callers
 * that stamp a time or imply freshness must check `live` first; BuyScreen's
 * "AS OF <time>" over snapshot values was the bug that forced this shape.
 */
export interface PriceRead {
  prices: Record<string, number>;
  /** Symbols whose price came from the live API on this call. */
  live: Set<string>;
}

export async function fetchPricesUsd(symbols: string[]): Promise<PriceRead> {
  const uniq = [...new Set(symbols)];
  const out: Record<string, number> = {};
  const live = new Set<string>();
  for (const s of uniq) {
    if (STATIC_PRICES_USD[s] != null) out[s] = STATIC_PRICES_USD[s];
  }
  if (!KEY || uniq.length === 0) return { prices: out, live };

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
      if (Number.isFinite(v)) {
        out[d.symbol] = v;
        live.add(d.symbol);
      }
    }
  } catch {
    // The static map stands — and `live` stays empty, which is the signal.
  } finally {
    clearTimeout(timer);
  }
  return { prices: out, live };
}
