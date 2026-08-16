/**
 * The Primal gateway client. Import from here, not from the files inside.
 *
 *   import { get, post, ApiError, formatMoney, toDate } from "@/lib/gateway";
 *
 * Feature modules (subscriptions, LinkPay accounts, withdrawals, VAS) build on
 * `request`/`get`/`post` and the types below. Nothing outside this folder
 * should call `fetch` against api.tsion.io, hold a token, or decide for itself
 * whether a user is entitled.
 */

export {
  GATEWAY_BASE_URL,
  get,
  newIdempotencyKey,
  post,
  refreshSession,
  request,
  type HttpMethod,
  type RequestOptions,
} from "./client";

export * from "./types";

export {
  addMoney,
  compareMoney,
  CURRENCY_DECIMALS,
  decimalsFor,
  formatMinor,
  formatMoney,
  isKnownCurrency,
  isNegativeMoney,
  isZeroMoney,
  money,
  MoneyError,
  negateMoney,
  normalizeCurrency,
  parseMinor,
  parseMoney,
  subtractMoney,
  symbolFor,
  toBigInt,
  zero,
  type FormatOptions,
  type ParseOptions,
} from "./money";

export {
  CLOCK_SKEW_MS,
  formatCountdown,
  isExpired,
  millisUntil,
  protoTimestampToDate,
  toDate,
  toMillis,
  toProtoTimestamp,
} from "./time";

export * as auth from "./auth";
export * as gatewaySession from "./session";
export * as entitlement from "./entitlement";
