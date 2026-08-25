import { describe, expect, test } from "bun:test";

import type { Holding } from "@/lib/crypto/balances";
import { directWithdrawalBlock } from "@/lib/crypto/withdraw";

function holding(overrides: Partial<Holding>): Holding {
  return {
    symbol: "USDC",
    name: "USD Coin",
    network: "base-mainnet",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    balance: 10,
    rawBalance: "10000000",
    priceUsd: 1,
    valueUsd: 10,
    stable: true,
    ...overrides,
  };
}

describe("direct crypto withdrawal availability", () => {
  test("offers native EVM assets without asking for a second gas asset", () => {
    const eth = holding({ symbol: "ETH", address: null, decimals: 18 });
    expect(directWithdrawalBlock(eth, [])).toBeNull();
  });

  test("offers an EVM token only when the same network has native gas", () => {
    const usdc = holding({});
    expect(directWithdrawalBlock(usdc, [])).toBe("needs_gas");
    expect(directWithdrawalBlock(usdc, ["eth-mainnet"])).toBe("needs_gas");
    expect(directWithdrawalBlock(usdc, ["base-mainnet"])).toBeNull();
  });

  test("keeps Solana assets out until construction and broadcast are wired", () => {
    const sol = holding({
      symbol: "SOL",
      network: "solana-mainnet",
      address: null,
      decimals: 9,
    });
    expect(directWithdrawalBlock(sol, ["solana-mainnet"])).toBe("solana");
  });
});
