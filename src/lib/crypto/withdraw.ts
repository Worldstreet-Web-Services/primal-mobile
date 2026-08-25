import type { Holding } from "./balances";
import type { NetworkId } from "./catalog";

export type DirectWithdrawalBlock = "solana" | "needs_gas" | null;

/**
 * Whether Primal's direct Decane send can honestly offer this holding today.
 *
 * Solana signing is not wired to transaction construction/broadcast yet. EVM
 * token sends are user-paid, so an ERC-20 with no native balance on the same
 * network is not actionable either — showing it would lead only to a gas error.
 */
export function directWithdrawalBlock(
  holding: Holding,
  gasNetworks: readonly NetworkId[],
): DirectWithdrawalBlock {
  if (holding.network === "solana-mainnet") return "solana";
  if (holding.address === null) return null;
  return gasNetworks.includes(holding.network) ? null : "needs_gas";
}
