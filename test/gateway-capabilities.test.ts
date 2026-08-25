import { describe, expect, test } from "bun:test";

import { GATEWAY_CAPABILITIES } from "@/lib/gateway/capabilities";

describe("deployed Gateway capability boundary", () => {
  test("keeps the implemented authentication, subscription and LinkPay rails enabled", () => {
    expect(GATEWAY_CAPABILITIES.walletAuthentication).toBe(true);
    expect(GATEWAY_CAPABILITIES.subscriptionCheckout).toBe(true);
    expect(GATEWAY_CAPABILITIES.linkpayAccount).toBe(true);
    expect(GATEWAY_CAPABILITIES.linkpayBankDeposits).toBe(true);
    expect(GATEWAY_CAPABILITIES.linkpayBankWithdrawals).toBe(true);
    expect(GATEWAY_CAPABILITIES.linkpayServices).toBe(true);
  });

  test("fails closed for product rails missing from public API v0.1", () => {
    expect(GATEWAY_CAPABILITIES.cryptoDeposits).toBe(false);
    expect(GATEWAY_CAPABILITIES.cryptoWithdrawals).toBe(false);
    expect(GATEWAY_CAPABILITIES.fiatCryptoConversion).toBe(false);
    expect(GATEWAY_CAPABILITIES.crossChainRouting).toBe(false);
    expect(GATEWAY_CAPABILITIES.sponsoredGas).toBe(false);
  });
});
