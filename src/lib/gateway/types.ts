/**
 * The Primal gateway boundary — every shape that crosses the wire, in one file.
 *
 * Two rules run through all of it:
 *
 * 1. **Money is never a number.** Amounts arrive as integer minor units in a
 *    string (`"10000"` NGN = ₦100.00) and stay strings until `money.ts` turns
 *    them into BigInt. A float in this file would be a rounding bug waiting for
 *    a big enough balance.
 * 2. **Unknown enum values must not crash the UI.** Every status is a string
 *    union with an `UNKNOWN` member and a narrowing helper. A gateway that
 *    ships a new `GRACE_PERIOD_EXTENDED` tomorrow must render as "unknown", not
 *    throw inside a list row.
 *
 * Response *field* coverage is drawn from the written contract. The live
 * OpenAPI (https://api.tsion.io/openapi.json, v0.1.0) documents the request
 * DTOs but leaves almost every 200 body as an empty schema, so entity fields
 * below are typed optional unless the contract states them outright — a missing
 * field must read as `undefined`, never as a type error at the call site.
 */

/* ------------------------------------------------------------------ errors */

/** The gateway's error envelope, observed live on 400/401/404/503. */
export interface ErrorEnvelope {
  statusCode: number;
  /** Nest sends an array here for validation failures. */
  message: string | string[];
  correlationId?: string;
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
}

/**
 * Any non-2xx from the gateway. Carries the correlation id so a support ticket
 * can quote it — that id is the only safe thing in this object to log.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly correlationId: string | null;
  /**
   * A machine-readable code when the gateway sends one. The live envelope only
   * carries `{statusCode, message, correlationId}`, so treat this as best
   * effort and prefer the `is*` helpers below over comparing it directly.
   */
  readonly code: string | null;
  /** Populated on 429 from `Retry-After`, already in milliseconds. */
  readonly retryAfterMs: number | null;
  readonly rateLimit: RateLimitInfo | null;

  constructor(init: {
    statusCode: number;
    message: string;
    correlationId?: string | null;
    code?: string | null;
    retryAfterMs?: number | null;
    rateLimit?: RateLimitInfo | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.statusCode = init.statusCode;
    this.correlationId = init.correlationId ?? null;
    this.code = init.code ?? null;
    this.retryAfterMs = init.retryAfterMs ?? null;
    this.rateLimit = init.rateLimit ?? null;
  }

  /** Survives a transpile that breaks `instanceof` across module copies. */
  static is(error: unknown): error is ApiError {
    return error instanceof ApiError || (error as ApiError)?.name === "ApiError";
  }
}

/**
 * The signed-in user has no live subscription. This is the ONLY signal that
 * decides entitlement — never a decoded JWT, never a wallet transaction hash,
 * never a cached local flag.
 *
 * The written contract names the code `ACTIVE_SUBSCRIPTION_REQUIRED`. We could
 * not observe a real 403 (the gateway's User Management dependency was
 * returning 503 while this was built), and the observed envelope has no `code`
 * field at all — so the match is deliberately broad but scoped to 403, which
 * the contract reserves for entitlement.
 */
export function isEntitlementError(error: unknown): boolean {
  if (!ApiError.is(error) || error.statusCode !== 403) return false;
  const haystack = `${error.code ?? ""} ${error.message}`.toUpperCase();
  return (
    haystack.includes("ACTIVE_SUBSCRIPTION_REQUIRED") ||
    haystack.includes("SUBSCRIPTION")
  );
}

/**
 * The Primal token pair is gone or unusable and cannot be recovered without a
 * fresh SIWE signature. Distinct from a bare 401 on purpose: a 401 is retried
 * once behind a refresh, and only the failure of THAT becomes this.
 *
 * Route on this to sign-in. Do NOT route on it for a 403 — an unpaid user is
 * signed in perfectly well and belongs on the subscription screen.
 */
export class SessionExpiredError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SessionExpiredError";
    this.cause = cause;
  }
  static is(error: unknown): error is SessionExpiredError {
    return (
      error instanceof SessionExpiredError ||
      (error as SessionExpiredError)?.name === "SessionExpiredError"
    );
  }
}

/** The request never reached the gateway, or never came back. */
export class NetworkError extends Error {
  readonly correlationId: string | null;
  readonly timedOut: boolean;
  readonly cause: unknown;
  constructor(init: {
    message: string;
    correlationId?: string | null;
    timedOut?: boolean;
    cause?: unknown;
  }) {
    super(init.message);
    this.name = "NetworkError";
    this.correlationId = init.correlationId ?? null;
    this.timedOut = init.timedOut ?? false;
    this.cause = init.cause;
  }
  static is(error: unknown): error is NetworkError {
    return (
      error instanceof NetworkError ||
      (error as NetworkError)?.name === "NetworkError"
    );
  }
}

/** The caller aborted via its own `AbortSignal`. Never retried, never shown. */
export class AbortedError extends Error {
  constructor(message = "Request aborted.") {
    super(message);
    this.name = "AbortedError";
  }
  static is(error: unknown): error is AbortedError {
    return (
      error instanceof AbortedError ||
      (error as AbortedError)?.name === "AbortedError"
    );
  }
}

/* ------------------------------------------------------- enums + fallbacks */

/**
 * Narrow an unknown wire value to one of `allowed`, or `"UNKNOWN"`.
 * Case-normalised, because a gateway that starts sending lowercase must not
 * blank every status badge in the app.
 */
function oneOf<T extends string>(
  allowed: readonly T[],
  value: unknown,
): T | "UNKNOWN" {
  if (typeof value !== "string") return "UNKNOWN";
  const upper = value.toUpperCase();
  return (allowed as readonly string[]).includes(upper)
    ? (upper as T)
    : "UNKNOWN";
}

export const SUBSCRIPTION_STATUSES = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "PAST_DUE",
  "GRACE_PERIOD",
  "CANCEL_AT_PERIOD_END",
  "EXPIRED",
  "CANCELED",
  "REVOKED",
] as const;
export type SubscriptionStatus =
  | (typeof SUBSCRIPTION_STATUSES)[number]
  | "UNKNOWN";
export const asSubscriptionStatus = (v: unknown): SubscriptionStatus =>
  oneOf(SUBSCRIPTION_STATUSES, v);

export const PAYMENT_STATUSES = [
  "AWAITING_TRANSFER",
  "PROCESSING",
  "SETTLED",
  "FAILED",
  "EXPIRED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number] | "UNKNOWN";
export const asPaymentStatus = (v: unknown): PaymentStatus =>
  oneOf(PAYMENT_STATUSES, v);

export const ACCOUNT_STATUSES = [
  "PENDING_KYC",
  "CUSTOMER_CREATED",
  "ACTIVE",
  "DISABLED",
  "PROVISION_FAILED",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number] | "UNKNOWN";
export const asAccountStatus = (v: unknown): AccountStatus =>
  oneOf(ACCOUNT_STATUSES, v);

export const DEPOSIT_STATUSES = ["DETECTED", "CREDITED", "REJECTED"] as const;
export type DepositStatus = (typeof DEPOSIT_STATUSES)[number] | "UNKNOWN";
export const asDepositStatus = (v: unknown): DepositStatus =>
  oneOf(DEPOSIT_STATUSES, v);

/**
 * Shared by withdrawals and service purchases — the contract gives them the
 * same machine, with `SETTLED` the terminal state for money out and
 * `DELIVERED` for airtime/data/bills.
 */
export const TRANSFER_STATUSES = [
  "REQUESTED",
  "SUBMITTED",
  "PROCESSING",
  "SETTLED",
  "DELIVERED",
  "FAILED",
  "REVERSED",
] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number] | "UNKNOWN";
export const asTransferStatus = (v: unknown): TransferStatus =>
  oneOf(TRANSFER_STATUSES, v);

/** True once no further movement is possible — safe to stop polling. */
export function isTerminalTransfer(status: TransferStatus): boolean {
  return status === "SETTLED" || status === "DELIVERED" || status === "FAILED" || status === "REVERSED";
}

/* ------------------------------------------------------------------- money */

/** Integer minor units in a string, plus the currency that scales them. */
export interface Money {
  amountMinor: string;
  currency: string;
}

/* -------------------------------------------------------------------- time */

/**
 * Subscription and payment timestamps arrive as protobuf timestamps; auth
 * expiries arrive as ISO strings. `time.ts` has the one converter that takes
 * either — do not hand-roll a second one.
 */
export interface ProtoTimestamp {
  seconds: string | number;
  nanos?: number;
}

/**
 * Anything that might be a moment in time — the two wire dialects, plus `Date`
 * so a value already converted once can be passed straight back in without
 * every caller having to remember which side of the boundary it came from.
 */
export type WireTimestamp =
  | ProtoTimestamp
  | Date
  | string
  | number
  | null
  | undefined;

/* -------------------------------------------------------------------- auth */

export interface ChallengeResponse {
  /** Sign this EXACTLY as given — no trim, no normalise, no re-encode. */
  message: string;
  nonce: string;
  /** ISO-8601. Challenges are single-use and expire. */
  expiresAt: string;
}

export interface GatewayUser {
  id: string;
  walletAddress: string;
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: GatewayUser;
}

export interface MeResponse {
  userId: string;
  walletAddress: string;
  sessionId: string;
}

/* ------------------------------------------------------------ subscription */

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  price?: Money;
  currentPeriodStart?: WireTimestamp;
  currentPeriodEnd?: WireTimestamp;
  cancelAtPeriodEnd?: boolean;
  createdAt?: WireTimestamp;
  updatedAt?: WireTimestamp;
}

/**
 * The crypto leg of a subscription.
 *
 * `depositAddress` is a ONE-TIME address minted for this payment. It is never
 * the treasury, it must never be cached across payments, and a transfer to a
 * stale one is money gone.
 *
 * Three amounts, three meanings, none interchangeable:
 * - `amountMinor` — the price, USD 2dp (`"100000"` = $1,000.00).
 * - `requiredSettlementAmount` — what must land, USDC 6dp (`"1000000000"`).
 * - `originAmount` — grossed up for provider fees; **this** is what the user
 *   sends from `originChainId`/`originAsset`.
 */
export interface CryptoPayment {
  id: string;
  subscriptionId?: string;
  status: PaymentStatus;
  depositAddress: string;
  originChainId?: number;
  originAsset?: string;
  originAmount?: string;
  requiredSettlementAmount?: string;
  amountMinor?: string;
  currency?: string;
  refundTo?: string;
  expiresAt?: WireTimestamp;
  createdAt?: WireTimestamp;
}

export interface CreateSubscriptionResponse {
  subscription: Subscription;
  payment: CryptoPayment;
}

/* ----------------------------------------------------------------- linkpay */

export interface Account {
  id?: string;
  status: AccountStatus;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  currency?: string;
  country?: string;
  createdAt?: WireTimestamp;
}

export interface Balance {
  available?: Money;
  ledger?: Money;
  currency?: string;
}

export interface Deposit {
  id: string;
  status: DepositStatus;
  amount?: Money;
  narration?: string;
  reference?: string;
  senderName?: string;
  senderBank?: string;
  createdAt?: WireTimestamp;
  creditedAt?: WireTimestamp;
}

export interface Bank {
  /** The gateway keys banks by uuid, not by code — send this to validate. */
  uuid: string;
  name: string;
  code?: string;
  country?: string;
  currency?: string;
}

export interface BankAccountResolution {
  accountName: string;
  bankName: string;
  bankCode: string;
}

export interface WithdrawalQuote {
  fee: Money;
  totalDebit: Money;
}

export interface Withdrawal {
  id: string;
  status: TransferStatus;
  amount?: Money;
  fee?: Money;
  totalDebit?: Money;
  destinationAccount?: string;
  destinationBankUuid?: string;
  accountName?: string;
  bankName?: string;
  narration?: string;
  reference?: string;
  failureReason?: string;
  createdAt?: WireTimestamp;
  settledAt?: WireTimestamp;
}

export interface ServiceProvider {
  id: string;
  name: string;
  serviceType?: string;
  category?: string;
  country?: string;
  logoUrl?: string;
}

export interface ServiceProduct {
  code: string;
  name: string;
  serviceProviderId?: string;
  amount?: Money;
  /** Some products (airtime) take any amount; some (data bundles) do not. */
  fixedAmount?: boolean;
}

export interface ServiceTransaction {
  id: string;
  status: TransferStatus;
  amount?: Money;
  serviceType?: string;
  serviceCategory?: string;
  serviceProviderId?: string;
  serviceProductCode?: string;
  destinationIdentifier?: string;
  narration?: string;
  reference?: string;
  token?: string;
  failureReason?: string;
  createdAt?: WireTimestamp;
}

/* -------------------------------------------------------------- pagination */

/** What the caller sends. The gateway takes `skip`/`take`, not page numbers. */
export interface PageInfo {
  skip?: number;
  take?: number;
}

/**
 * What comes back. The live OpenAPI documents no list response body, so
 * `readPage` accepts a bare array as well as the usual envelopes rather than
 * betting on one and crashing on the other.
 */
export interface Page<T> {
  items: T[];
  total: number | null;
  skip: number | null;
  take: number | null;
}

export function readPage<T>(raw: unknown, map: (item: unknown) => T): Page<T> {
  if (Array.isArray(raw)) {
    return { items: raw.map(map), total: raw.length, skip: null, take: null };
  }
  const o = (raw ?? {}) as Record<string, unknown>;
  const list = [o.items, o.data, o.results, o.records].find(Array.isArray) as
    | unknown[]
    | undefined;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    items: (list ?? []).map(map),
    total: num(o.total) ?? num(o.count) ?? null,
    skip: num(o.skip),
    take: num(o.take),
  };
}

/* -------------------------------------------------------------- app states */

/**
 * The app's single read of "can this person use Paradigm right now", per the
 * contract. Every one of these except `anonymous` means a Decane wallet exists.
 *
 * - `anonymous`            — no Decane session; show sign-in.
 * - `session_expired`      — had a Primal session, cannot renew it; sign in again.
 * - `authenticated_unpaid` — signed in, gateway says no entitlement (403).
 * - `payment_pending`      — a subscription exists awaiting its crypto transfer.
 * - `entitlement_syncing`  — the subscription reads ACTIVE but entitled routes
 *                            still 403; the backend is catching up, so wait and
 *                            re-probe rather than asking for money twice.
 * - `active`               — entitled. The only state that opens LinkPay.
 * - `cancel_at_period_end` — entitled, but not renewing.
 * - `expired`              — was entitled, no longer.
 *
 * `unknown` is the pre-decision state at launch, before the first probe lands.
 */
export type PrimalAppState =
  | "unknown"
  | "anonymous"
  | "session_expired"
  | "authenticated_unpaid"
  | "payment_pending"
  | "entitlement_syncing"
  | "active"
  | "cancel_at_period_end"
  | "expired";

/** States in which entitled (LinkPay) routes are expected to succeed. */
export function isEntitled(state: PrimalAppState): boolean {
  return state === "active" || state === "cancel_at_period_end";
}
