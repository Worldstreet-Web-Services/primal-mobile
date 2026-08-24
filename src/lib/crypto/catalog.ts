import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  type Chain,
} from "viem/chains";

// The fixed set of assets KashPlus reads on-chain, modeled on Ark's portfolio
// networks (eth/base/arb/opt/polygon + solana). A fixed catalog — versus
// Alchemy's discover-everything scan — keeps balance reads plain viem calls
// against public RPCs with no indexer dependency, at the cost of only seeing
// assets we list. Extend the list to extend the portfolio.

export type EvmNetworkId =
  | "eth-mainnet"
  | "base-mainnet"
  | "arb-mainnet"
  | "opt-mainnet"
  | "polygon-mainnet";

export type NetworkId = EvmNetworkId | "solana-mainnet";

export const NETWORK_LABELS: Record<NetworkId, string> = {
  "eth-mainnet": "Ethereum",
  "base-mainnet": "Base",
  "arb-mainnet": "Arbitrum",
  "opt-mainnet": "Optimism",
  "polygon-mainnet": "Polygon",
  "solana-mainnet": "Solana",
};

export const EVM_CHAINS: Record<EvmNetworkId, Chain> = {
  "eth-mainnet": mainnet,
  "base-mainnet": base,
  "arb-mainnet": arbitrum,
  "opt-mainnet": optimism,
  "polygon-mainnet": polygon,
};

export const EVM_CHAIN_ID: Record<EvmNetworkId, number> = {
  "eth-mainnet": 1,
  "base-mainnet": 8453,
  "arb-mainnet": 42161,
  "opt-mainnet": 10,
  "polygon-mainnet": 137,
};

/** The chain a native coin "belongs" to — rows elsewhere carry a network
 * suffix so two ETH rows never read identical. */
export const NATIVE_HOME: Record<string, NetworkId> = {
  ETH: "eth-mainnet",
  SOL: "solana-mainnet",
  POL: "polygon-mainnet",
};

export interface CatalogToken {
  symbol: string;
  name: string;
  network: NetworkId;
  /** Contract (EVM) / mint (Solana); null = the chain's native coin. */
  address: string | null;
  decimals: number;
  /** Stablecoins render with money-in green accents and 2dp amounts. */
  stable?: boolean;
}

export const TOKEN_CATALOG: CatalogToken[] = [
  // Ethereum mainnet
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "eth-mainnet",
    address: null,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "eth-mainnet",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "eth-mainnet",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "DAI",
    name: "Dai",
    network: "eth-mainnet",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    stable: true,
  },
  // Base
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "base-mainnet",
    address: null,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "base-mainnet",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "DAI",
    name: "Dai",
    network: "base-mainnet",
    address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    decimals: 18,
    stable: true,
  },
  // Arbitrum
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "arb-mainnet",
    address: null,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "arb-mainnet",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "arb-mainnet",
    address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    decimals: 6,
    stable: true,
  },
  // Optimism
  {
    symbol: "ETH",
    name: "Ethereum",
    network: "opt-mainnet",
    address: null,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "opt-mainnet",
    address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "opt-mainnet",
    address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    decimals: 6,
    stable: true,
  },
  // Polygon
  {
    symbol: "POL",
    name: "Polygon",
    network: "polygon-mainnet",
    address: null,
    decimals: 18,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "polygon-mainnet",
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "polygon-mainnet",
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6,
    stable: true,
  },
  // Solana
  {
    symbol: "SOL",
    name: "Solana",
    network: "solana-mainnet",
    address: null,
    decimals: 9,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    network: "solana-mainnet",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    stable: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    network: "solana-mainnet",
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    stable: true,
  },
];
