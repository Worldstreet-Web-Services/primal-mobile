import { create } from "zustand";

import { fetchHoldings, type Holding } from "@/lib/crypto/balances";
import { getCryptoWallet } from "@/lib/crypto/wallet";

// Live portfolio for the wallet seam's addresses. Ark's store polls every
// 60s; this one refreshes politely — on screen mount (`ensure`, stale-guarded)
// and on manual refresh — because KashPlus has no signed-in wallets yet and
// hot-polling public RPCs from a demo build is noise. Ark's hard rule ports
// intact: a fetch failure with no data flags error — never $0.00.

/** Below this age, a remount doesn't warrant a refetch. */
const STALE_MS = 60_000;

interface PortfolioState {
  holdings: Holding[];
  totalUsd: number;
  /** True until the first response (or terminal failure) for this address set. */
  loading: boolean;
  /** A refresh is in flight while data is already on screen. */
  refreshing: boolean;
  error: boolean;
  /**
   * True when every chain answered. False means the holdings below are a FLOOR,
   * not a total — some chains failed while others succeeded, so an empty or
   * small list may simply be the part we could see. Anything that would state a
   * total, or read zero as "nothing held", has to consult this first.
   */
  complete: boolean;

  /** Load if stale — screens call this on mount. Safe to call repeatedly. */
  ensure: () => void;
  /** Immediate refresh (after a deposit/withdraw, or pull). */
  refresh: () => Promise<void>;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => {
  let lastFetchedAt = 0;
  let inFlight: Promise<void> | null = null;
  /** Address set behind the current data — a switch wipes before fetching. */
  let addrKey = "";

  const fetchOnce = async (isRefresh: boolean) => {
    // Addresses come from the seam at call time, so a Decane sign-in that
    // installs a real wallet is picked up by the very next load.
    const addrs = getCryptoWallet().getAddresses();
    const evm = addrs?.evm ?? null;
    const solana = addrs?.solana ?? null;
    if (!evm && !solana) {
      set({ loading: false, refreshing: false, error: true, complete: false });
      return;
    }

    // A different PERSON must never see the previous account's money as
    // theirs, so a genuine address switch wipes before fetching.
    const key = `${evm}|${solana}`;
    if (key !== addrKey) {
      addrKey = key;
      lastFetchedAt = 0;
      if (get().holdings.length > 0) {
        set({ holdings: [], totalUsd: 0, loading: true, error: false });
      }
    }

    if (isRefresh) set({ refreshing: true });
    try {
      const { holdings, complete } = await fetchHoldings(evm, solana);
      lastFetchedAt = Date.now();
      set({
        holdings,
        totalUsd: holdings.reduce((sum, h) => sum + h.valueUsd, 0),
        loading: false,
        refreshing: false,
        error: false,
        complete,
      });
    } catch {
      // Keep any previously shown data; only flag error.
      set({ loading: false, refreshing: false, error: true, complete: false });
    }
  };

  const load = (isRefresh: boolean): Promise<void> => {
    // A refresh landing mid-load must resolve when that load does — dropping
    // it would leave the spinner attached to a request that no longer exists.
    if (inFlight) {
      if (isRefresh) set({ refreshing: true });
      return inFlight;
    }
    inFlight = fetchOnce(isRefresh).finally(() => {
      inFlight = null;
      if (get().refreshing) set({ refreshing: false });
    });
    return inFlight;
  };

  return {
    holdings: [],
    complete: false,
    totalUsd: 0,
    loading: true,
    refreshing: false,
    error: false,

    ensure: () => {
      if (Date.now() - lastFetchedAt <= STALE_MS) return;
      void load(get().holdings.length > 0);
    },

    refresh: () => load(true),
  };
});
