import { useEffect } from "react";

import { usePortfolioStore } from "@/store/portfolio";

/** Portfolio access for screens: kicks a stale-guarded load on mount (no
 * polling — the store's politeness rules apply) and returns the live state. */
export function useCryptoPortfolio() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const gasNetworks = usePortfolioStore((s) => s.gasNetworks);
  const totalUsd = usePortfolioStore((s) => s.totalUsd);
  const loading = usePortfolioStore((s) => s.loading);
  const refreshing = usePortfolioStore((s) => s.refreshing);
  const error = usePortfolioStore((s) => s.error);
  const complete = usePortfolioStore((s) => s.complete);
  const pricesLive = usePortfolioStore((s) => s.pricesLive);
  const ensure = usePortfolioStore((s) => s.ensure);
  const refresh = usePortfolioStore((s) => s.refresh);

  useEffect(() => {
    ensure();
  }, [ensure]);

  return {
    holdings,
    gasNetworks,
    totalUsd,
    loading,
    refreshing,
    error,
    complete,
    pricesLive,
    refresh,
  };
}
