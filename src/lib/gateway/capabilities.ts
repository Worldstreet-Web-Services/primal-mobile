/**
 * Product capabilities exposed by the deployed Primal API Gateway.
 *
 * This is a presentation boundary, not an authorization mechanism. The
 * Gateway remains authoritative for authentication and entitlement. Keeping
 * the unsupported rails explicit prevents the UI from quietly falling back to
 * a provider API that the frontend contract says it must never call directly.
 */
export const GATEWAY_CAPABILITIES = {
  walletAuthentication: true,
  subscriptionCheckout: true,
  linkpayAccount: true,
  linkpayBankDeposits: true,
  linkpayBankWithdrawals: true,
  linkpayServices: true,

  // No public Gateway routes exist for these in API v0.1.0.
  cryptoDeposits: false,
  cryptoWithdrawals: false,
  fiatCryptoConversion: false,
  crossChainRouting: false,
  sponsoredGas: false,
} as const;

export type GatewayCapability = keyof typeof GATEWAY_CAPABILITIES;

