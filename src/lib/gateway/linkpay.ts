/**
 * LinkPay — the naira rails: a provisioned bank account, the money that lands
 * in it, and the money that leaves it.
 *
 * Everything here sits on `client.ts`. There is no second fetch, no second
 * money helper, no second timestamp converter, and no local opinion about
 * whether the user is entitled — a 403 from the gateway is the only answer to
 * that question and it leaves this module untouched for the caller to route on.
 *
 * Three things this file is deliberately strict about:
 *
 * 1. **Response shapes are unverified.** The live OpenAPI (v0.1.0) documents
 *    the request DTOs and leaves every 200 body empty, so nothing below indexes
 *    blindly into a response. Each entity goes through a reader that tolerates
 *    an envelope (`{account: …}`), a bare object, and a missing field, and that
 *    funnels every status through the `UNKNOWN`-safe narrowers in `types.ts`.
 * 2. **Idempotency keys are storage, not decoration.** A key is minted once per
 *    intended operation and persisted, so a timeout, a crash, or a relaunch
 *    replays the SAME key instead of performing the operation twice. The only
 *    thing that mints a second key is the user genuinely changing what they
 *    asked for — and then the old one is dropped first.
 * 3. **The BVN never lands anywhere.** It is a function argument on the way to
 *    a request body and nothing else: not a log line, not a stored fingerprint,
 *    not part of any idempotency record. The persisted provisioning record
 *    holds a key and nothing about the person.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { get, newIdempotencyKey, post } from "./client";
import { normalizeCurrency } from "./money";
import { toMillis } from "./time";
import {
  ApiError,
  NetworkError,
  SessionExpiredError,
  asAccountStatus,
  asDepositStatus,
  asTransferStatus,
  isEntitlementError,
  isTerminalTransfer,
  readPage,
  type Account,
  type AccountStatus,
  type Balance,
  type Bank,
  type BankAccountResolution,
  type Deposit,
  type DepositStatus,
  type Money,
  type Page,
  type PageInfo,
  type TransferStatus,
  type Withdrawal,
  type WithdrawalQuote,
  type WireTimestamp,
} from "./types";

/** Per-call knobs every function here accepts. */
export interface Call {
  /** Cancel when the screen unmounts, so a stale response can't land. */
  signal?: AbortSignal;
  /** Share one id across the calls that make up a single user operation. */
  correlationId?: string;
}

/* ------------------------------------------------------------------ readers */

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Peel a one-key envelope (`{account: {...}}`) without assuming there is one. */
function unwrap(raw: unknown, ...keys: string[]): Record<string, unknown> {
  const node = obj(raw);
  for (const key of keys) {
    const inner = node[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
  }
  return node;
}

/** Minor units are an integer count of the smallest unit. Nothing else is one. */
const MINOR_UNITS = /^-?\d+$/;

/**
 * A minor-unit string, or nothing.
 *
 * `"12500.00"` is what an ORM Decimal looks like after JSON.stringify, and it
 * is not a minor-unit amount — reading it as one would mean guessing whether
 * the gateway meant ₦125.00 or ₦12,500.00. Worse, every arithmetic helper in
 * `money.ts` THROWS on it, and screens compare balances in their render body,
 * so one malformed field arrives as a red box over someone's payout. It reads
 * as absent instead: rows print an em dash, comparisons decline to be made,
 * and the gateway stays the authority on the figure.
 */
function minorUnits(raw: string, currency: string): Money | undefined {
  const trimmed = raw.trim();
  return MINOR_UNITS.test(trimmed) ? { amountMinor: trimmed, currency } : undefined;
}

/**
 * Read a money value in whichever shape it arrives: nested (`{amountMinor,
 * currency}`), split across sibling fields, or a bare minor-unit string beside
 * a currency somewhere else.
 *
 * A JSON *number* is accepted only when it is an integer, and never converted
 * from a decimal. `100.5` as a number would be a gateway bug, and guessing
 * whether it meant ₦1.005 or ₦100.50 is exactly the guess that loses money —
 * so it reads as absent and the row renders an em dash instead of a lie. A
 * *string* gets the identical treatment, for the identical reason.
 */
function readMoney(value: unknown, fallbackCurrency?: string): Money | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string" || typeof value === "number") {
    const currency = str(fallbackCurrency);
    if (!currency) return undefined;
    if (typeof value === "number") {
      return Number.isInteger(value)
        ? { amountMinor: String(value), currency }
        : undefined;
    }
    return minorUnits(value, currency);
  }

  const node = obj(value);
  const rawAmount = node.amountMinor ?? node.amount ?? node.value ?? node.minor;
  const currency = str(node.currency) ?? str(node.currencyCode) ?? str(fallbackCurrency);
  if (!currency) return undefined;

  if (typeof rawAmount === "number") {
    return Number.isInteger(rawAmount)
      ? { amountMinor: String(rawAmount), currency }
      : undefined;
  }
  const amountMinor = str(rawAmount);
  return amountMinor ? minorUnits(amountMinor, currency) : undefined;
}

/**
 * The first timestamp-ish field present, left in wire form.
 *
 * No conversion happens here on purpose: `time.ts` owns the one converter that
 * handles both dialects, and a second `new Date(…)` in this file is exactly the
 * duplicate that gets one of them wrong.
 */
function readTime(node: Record<string, unknown>, ...keys: string[]): WireTimestamp {
  for (const key of keys) {
    const value = node[key];
    if (value !== null && value !== undefined && value !== "") {
      return value as WireTimestamp;
    }
  }
  return undefined;
}

/**
 * A LinkPay account, plus the one field the contract names that the shared
 * `Account` type does not carry: why provisioning failed.
 */
export interface LinkpayAccount extends Account {
  /** Only meaningful on `PROVISION_FAILED`. Operator-written; show it as-is. */
  failureReason?: string;
}

function readAccount(raw: unknown): LinkpayAccount {
  const node = unwrap(raw, "account", "data");
  return {
    id: str(node.id) ?? str(node.accountId),
    status: asAccountStatus(node.status ?? node.accountStatus),
    accountNumber: str(node.accountNumber) ?? str(node.nuban) ?? str(node.number),
    accountName: str(node.accountName) ?? str(node.name),
    bankName: str(node.bankName) ?? str(node.bank),
    bankCode: str(node.bankCode),
    currency: str(node.currency),
    country: str(node.country),
    createdAt: readTime(node, "createdAt", "created_at"),
    failureReason:
      str(node.failureReason) ?? str(node.failure_reason) ?? str(node.reason),
  };
}

function readBalance(raw: unknown): Balance {
  const node = unwrap(raw, "balance", "data");
  const currency = str(node.currency) ?? "NGN";
  return {
    available:
      readMoney(node.available, currency) ??
      readMoney(node.availableBalance, currency) ??
      readMoney(node.amountMinor, currency),
    ledger:
      readMoney(node.ledger, currency) ??
      readMoney(node.ledgerBalance, currency) ??
      readMoney(node.total, currency),
    currency,
  };
}

function readDeposit(raw: unknown): Deposit {
  const node = unwrap(raw, "deposit");
  return {
    id: str(node.id) ?? str(node.depositId) ?? str(node.reference) ?? "",
    status: asDepositStatus(node.status),
    amount: readMoney(node.amount, str(node.currency)),
    narration: str(node.narration) ?? str(node.description),
    reference: str(node.reference) ?? str(node.transactionReference),
    senderName: str(node.senderName) ?? str(node.payerName),
    senderBank: str(node.senderBank) ?? str(node.payerBank),
    createdAt: readTime(node, "createdAt", "detectedAt", "created_at"),
    creditedAt: readTime(node, "creditedAt", "credited_at"),
  };
}

function readBank(raw: unknown): Bank {
  const node = obj(raw);
  return {
    uuid: str(node.uuid) ?? str(node.bankUuid) ?? str(node.id) ?? "",
    name: str(node.name) ?? str(node.bankName) ?? "Unnamed bank",
    code: str(node.code) ?? str(node.bankCode),
    country: str(node.country),
    currency: str(node.currency),
  };
}

function readResolution(raw: unknown): BankAccountResolution {
  const node = unwrap(raw, "account", "data", "result");
  return {
    accountName: str(node.accountName) ?? str(node.name) ?? "",
    bankName: str(node.bankName) ?? "",
    bankCode: str(node.bankCode) ?? "",
  };
}

function readQuote(raw: unknown, currency: string): WithdrawalQuote {
  const node = unwrap(raw, "quote", "data");
  return {
    fee: readMoney(node.fee, currency) ?? { amountMinor: "0", currency },
    totalDebit:
      readMoney(node.totalDebit, currency) ??
      readMoney(node.total, currency) ?? { amountMinor: "0", currency },
  };
}

function readWithdrawal(raw: unknown): Withdrawal {
  const node = unwrap(raw, "withdrawal");
  const currency = str(node.currency);
  return {
    id: str(node.id) ?? str(node.withdrawalId) ?? "",
    status: asTransferStatus(node.status),
    amount: readMoney(node.amount, currency),
    fee: readMoney(node.fee, currency),
    totalDebit: readMoney(node.totalDebit, currency),
    destinationAccount: str(node.destinationAccount) ?? str(node.accountNumber),
    destinationBankUuid: str(node.destinationBankUuid) ?? str(node.bankUuid),
    accountName: str(node.accountName) ?? str(node.beneficiaryName),
    bankName: str(node.bankName),
    narration: str(node.narration),
    reference: str(node.reference),
    failureReason: str(node.failureReason) ?? str(node.reason),
    createdAt: readTime(node, "createdAt", "created_at"),
    settledAt: readTime(node, "settledAt", "completedAt"),
  };
}

/* ------------------------------------------------------------------ account */

/** Provisioning has started but not finished. Retry with the SAME key. */
export function isProvisioning(status: AccountStatus): boolean {
  return status === "PENDING_KYC" || status === "CUSTOMER_CREATED";
}

/** The account can take deposits and fund withdrawals. */
export function isAccountUsable(status: AccountStatus): boolean {
  return status === "ACTIVE";
}

/**
 * The account, or `null` when this user has never provisioned one.
 *
 * A 404 here is a real answer, not a failure: the entitlement guard runs ahead
 * of the lookup, so reaching a 404 at all means the gateway let us in.
 */
export async function getAccount(call: Call = {}): Promise<LinkpayAccount | null> {
  try {
    return readAccount(await get<unknown>("/v1/linkpay/account", call));
  } catch (error) {
    if (ApiError.is(error) && error.statusCode === 404) return null;
    throw error;
  }
}

export interface ProvisionInput {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  /**
   * Bank Verification Number. Lives in form state, travels through here into
   * one request body, and is never stored, logged or fingerprinted.
   */
  bvn: string;
  /** ISO-3166 alpha-2. `NG` today. */
  country: string;
  /** ISO-4217. `NGN` today. */
  currency: string;
}

/**
 * Provision the user's naira account.
 *
 * `idempotencyKey` is supplied by the caller rather than minted here, because
 * only the caller knows whether this is the same attempt being retried or a
 * genuinely new one. Use `reserveIdempotencyKey(PROVISION_SLOT, …)`.
 */
export async function provisionAccount(
  input: ProvisionInput,
  idempotencyKey: string,
  call: Call = {},
): Promise<LinkpayAccount> {
  return readAccount(
    await post<unknown>(
      "/v1/linkpay/accounts",
      {
        idempotencyKey,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        email: input.email,
        bvn: input.bvn,
        country: input.country,
        currency: input.currency,
      },
      call,
    ),
  );
}

/**
 * A 200 that carries nothing.
 *
 * The contract says an unprovisioned user gets a 404, and `getAccount` turns
 * that into `null`. But the live OpenAPI documents no 200 body at all, so a
 * gateway that answers `{}` (or `{account: null}`) instead would otherwise read
 * as an account in an unrecognised state — and park a user in front of an
 * "unknown status" panel when what they actually need is the provisioning CTA.
 * Same answer for both shapes: there is no account here.
 */
export function isBlankAccount(account: LinkpayAccount | null | undefined): boolean {
  if (!account) return true;
  return (
    account.status === "UNKNOWN" &&
    account.id === undefined &&
    account.accountNumber === undefined
  );
}

/* ------------------------------------------------------------------ balance */

export async function getBalance(call: Call = {}): Promise<Balance> {
  return readBalance(await get<unknown>("/v1/linkpay/balance", call));
}

/* ----------------------------------------------------------------- deposits */

export async function listDeposits(
  page: PageInfo = {},
  call: Call = {},
): Promise<Page<Deposit>> {
  const raw = await get<unknown>("/v1/linkpay/deposits", {
    ...call,
    query: { skip: page.skip, take: page.take },
  });
  return readPage(raw, readDeposit);
}

export async function getDeposit(id: string, call: Call = {}): Promise<Deposit> {
  return readDeposit(
    await get<unknown>(`/v1/linkpay/deposits/${encodeURIComponent(id)}`, call),
  );
}

/* -------------------------------------------------------------------- banks */

/**
 * The bank list is long, static for the length of a session, and needed by
 * every payout — so it is fetched once per country/currency and kept in memory.
 * Never persisted: a stale bank uuid is a payout to nobody.
 */
const bankCache = new Map<string, { banks: Bank[]; at: number }>();
const BANK_CACHE_MS = 30 * 60 * 1000;

export async function listBanks(
  params: { country: string; currency: string },
  call: Call = {},
): Promise<Bank[]> {
  const key = `${params.country}:${params.currency}`.toUpperCase();
  const hit = bankCache.get(key);
  if (hit && Date.now() - hit.at < BANK_CACHE_MS) return hit.banks;

  const raw = await get<unknown>("/v1/linkpay/banks", {
    ...call,
    query: { country: params.country, currency: params.currency },
  });
  // Rows with no uuid cannot be sent to `validate`, so they are dropped rather
  // than offered as a choice that fails at the next step.
  const banks = readPage(raw, readBank).items.filter((bank) => bank.uuid !== "");
  bankCache.set(key, { banks, at: Date.now() });
  return banks;
}

export interface ValidateBankInput {
  accountNumber: string;
  bankUuid: string;
  country: string;
  currency: string;
}

/**
 * Name enquiry. The resolved `accountName` is the only proof the money is going
 * where the user meant — it must be shown and acknowledged before anything is
 * initiated, never resolved-and-sent in one motion.
 */
export async function validateBankAccount(
  input: ValidateBankInput,
  call: Call = {},
): Promise<BankAccountResolution> {
  return readResolution(await post<unknown>("/v1/linkpay/banks/validate", input, call));
}

/* -------------------------------------------------------------- withdrawals */

/** Price the payout. Read-only — safe to call again whenever the amount moves. */
export async function quoteWithdrawal(
  amount: Money,
  call: Call = {},
): Promise<WithdrawalQuote> {
  const raw = await post<unknown>(
    "/v1/linkpay/withdrawals/quote",
    { amountMinor: amount.amountMinor, currency: amount.currency },
    call,
  );
  return readQuote(raw, amount.currency);
}

export interface WithdrawInput {
  amount: Money;
  destinationAccount: string;
  destinationBankUuid: string;
  narration?: string;
}

/**
 * Move the money.
 *
 * The key is the caller's, for the same reason as provisioning: a retry after a
 * timeout must carry the key the first attempt carried. Minting one here would
 * put a second payout one dropped packet away.
 */
export async function initiateWithdrawal(
  input: WithdrawInput,
  idempotencyKey: string,
  call: Call = {},
): Promise<Withdrawal> {
  return readWithdrawal(
    await post<unknown>(
      "/v1/linkpay/withdrawals",
      {
        idempotencyKey,
        amount: {
          amountMinor: input.amount.amountMinor,
          currency: input.amount.currency,
        },
        destinationAccount: input.destinationAccount,
        destinationBankUuid: input.destinationBankUuid,
        ...(input.narration ? { narration: input.narration } : null),
      },
      call,
    ),
  );
}

export async function getWithdrawal(id: string, call: Call = {}): Promise<Withdrawal> {
  return readWithdrawal(
    await get<unknown>(`/v1/linkpay/withdrawals/${encodeURIComponent(id)}`, call),
  );
}

export async function listWithdrawals(
  page: PageInfo & { status?: string } = {},
  call: Call = {},
): Promise<Page<Withdrawal>> {
  const raw = await get<unknown>("/v1/linkpay/withdrawals", {
    ...call,
    query: { skip: page.skip, take: page.take, status: page.status },
  });
  return readPage(raw, readWithdrawal);
}

/* ------------------------------------------------------- idempotency keys */

const isWeb = Platform.OS === "web";

const STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.gateway",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Web has no SecureStore, and a keychain read can fail on a device too. Losing
 * a key must not mean losing the flow, so a process-lifetime map stands in —
 * weaker than disk (it dies with the app) but never weaker than minting a fresh
 * key on every retry, which is the failure mode that costs money.
 */
const memoryKeys = new Map<string, string>();

/** Slot for the one account a user provisions. */
export const PROVISION_SLOT = "linkpay.account";
/**
 * The stem every payout slot is built on — and, on its own, the slot that
 * records written before payouts had one of their own were reserved under.
 *
 * Never hand this to `reserveIdempotencyKey` directly, and never derive a slot
 * at a call site either: `planWithdrawal` is the only sanctioned way to get a
 * key for a payout, because it is the only thing that knows a record already on
 * disk outranks anything a caller could derive.
 */
export const WITHDRAWAL_SLOT = "linkpay.withdrawal";

/**
 * A stable short name for WHAT a payout moves — every field that decides where
 * the money goes, and nothing that changes between two attempts at it.
 *
 * Two FNV-1a passes, concatenated. Not a security hash — nothing secret goes in
 * — just a stable name for a tuple, in a keychain key that has to stay
 * alphanumeric. It is one-way all the same, which is what lets the persisted
 * payout record carry it: the account number that goes in never comes back out,
 * and the record stays as thin on the person as it was before.
 */
export function withdrawalFingerprint(payout: {
  amount: Money;
  accountNumber: string;
  bankUuid: string;
}): string {
  const fingerprint = [
    payout.amount.amountMinor.trim(),
    normalizeCurrency(payout.amount.currency),
    payout.accountNumber.replace(/\D/g, ""),
    payout.bankUuid,
    // Joined on a character no bank feed can put inside a field, exactly as
    // `purchaseFingerprint` does: the boundaries have to be unambiguous or
    // "50" + "00123" fingerprints the same tuple as "5000" + "123". Written as
    // an escape on purpose — a raw NUL byte in a source file makes every tool
    // that reads it treat this module as binary.
  ].join("\u0000");

  const fnv = (seed: number, prime: number): string => {
    let hash = seed >>> 0;
    for (let i = 0; i < fingerprint.length; i += 1) {
      hash = (hash ^ fingerprint.charCodeAt(i)) >>> 0;
      hash = Math.imul(hash, prime) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  };

  return `${fnv(0x811c9dc5, 0x01000193)}${fnv(0x243f6a88, 0x01000193)}`;
}

/**
 * The idempotency slot for ONE ATTEMPT at one intended payout.
 *
 * Derived from every field that decides where the money goes, exactly as
 * `purchaseSlot` does for VAS. The SAME payout retried — after a timeout, a
 * crash, a relaunch — reserves the SAME key, and a DIFFERENT payout can never
 * be handed a key another payout already spent.
 *
 * One fixed slot for every payout a user ever makes is the version of this
 * that loses money: a key reserved for ₦50,000 to Chidi and never released is
 * handed straight to ₦20,000 to Ada, and the gateway then either 409s forever
 * or replays Chidi's transfer as the answer to Ada's.
 *
 * The fingerprint alone is not the slot either, and that is the other half of
 * it. Retrying the ₦5,000 to Ada that timed out and sending Ada ₦5,000 again
 * next week produce byte-identical payouts, so a fingerprint-only slot hands
 * the second one the first one's spent key — and a gateway doing its job then
 * answers Ada's second transfer with her first one, which is a receipt for
 * money that never moved. The attempt number is what separates them, and
 * `retireWithdrawal` is the only thing allowed to move it on: it does so at the
 * one moment the earlier attempt can no longer be resumed.
 *
 * Private on purpose. A caller holding a derived slot is one step from
 * reserving under it for a payout whose key is already sitting in a record —
 * which is the same transfer under two keys. `planWithdrawal` is the door.
 */
const slotFor = (fingerprint: string, attempt: number): string =>
  `${WITHDRAWAL_SLOT}.${fingerprint}.${attempt}`;

/**
 * What a slot NAMES, or `null` when nothing `slotFor` can produce equals it.
 *
 * The `null` answer is the useful one: a record written before payouts carried
 * an attempt sits under the bare stem, and no derived slot ever equals the bare
 * stem — so a key left there can never be handed to a later payout, whatever
 * the attempt ledger says.
 */
function parseWithdrawalSlot(
  slot: string,
): { fingerprint: string; attempt: number } | null {
  const prefix = `${WITHDRAWAL_SLOT}.`;
  if (!slot.startsWith(prefix)) return null;
  const rest = slot.slice(prefix.length);
  const cut = rest.lastIndexOf(".");
  if (cut <= 0) return null;
  const fingerprint = rest.slice(0, cut);
  const attempt = rest.slice(cut + 1);
  if (fingerprint === "" || !/^\d+$/.test(attempt)) return null;
  return { fingerprint, attempt: Number(attempt) };
}

const slotKey = (slot: string) => `paradigm.idem.${slot}`;

async function readSlot(slot: string): Promise<string | null> {
  const memory = memoryKeys.get(slot);
  if (memory) return memory;
  if (isWeb) return null;
  try {
    const stored = await SecureStore.getItemAsync(slotKey(slot), STORE_OPTIONS);
    if (stored) memoryKeys.set(slot, stored);
    return stored;
  } catch {
    return null;
  }
}

async function writeSlot(slot: string, key: string): Promise<void> {
  memoryKeys.set(slot, key);
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(slotKey(slot), key, STORE_OPTIONS);
  } catch {
    // The memory copy still holds for this launch.
  }
}

/**
 * The key for `slot`: the one already reserved, or a new one persisted now.
 *
 * Call this when the user COMMITS to an operation, and call it again on every
 * retry of that same operation — it returns the same string until the operation
 * is released. Never call it inside a catch block hoping for a fresh key.
 */
export async function reserveIdempotencyKey(
  slot: string,
  prefix: string,
): Promise<string> {
  const existing = await readSlot(slot);
  if (existing) return existing;
  const key = newIdempotencyKey(prefix);
  await writeSlot(slot, key);
  return key;
}

/**
 * Drop the reserved key.
 *
 * Two callers only: the operation reached a terminal state (done, or failed in
 * a way the gateway will not reconsider), or the user changed what they are
 * asking for. A timeout is neither.
 */
export async function releaseIdempotencyKey(slot: string): Promise<void> {
  memoryKeys.delete(slot);
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(slotKey(slot), STORE_OPTIONS);
  } catch {
    // Nothing to do — the memory copy is already gone.
  }
}

/* ----------------------------------------------- which attempt is current */

/**
 * Which attempt at a given payout the next send belongs to.
 *
 * The twin of `PurchaseAttempt` in `services.ts`, and it exists for the same
 * reason: the fingerprint says WHAT is being sent, and only the attempt number
 * can say whether an identical payout is the same operation retried or a second
 * one the user meant. Nothing about the person is in here — the fingerprint is
 * the one-way hash, never the account number it was built from.
 */
interface WithdrawalAttempt {
  fingerprint: string;
  /** Only ever moves forward, and only when an attempt is retired. */
  attempt: number;
}

const ATTEMPTS_KEY = "paradigm.linkpay.withdrawal_attempts";
/** Only payouts whose fingerprint may come round again need a row. */
const ATTEMPT_LIMIT = 8;

let attemptMemory: WithdrawalAttempt[] | null = null;

function readAttemptRow(value: unknown): WithdrawalAttempt | null {
  const row = obj(value);
  const fingerprint = typeof row.fingerprint === "string" ? row.fingerprint : "";
  const attempt =
    typeof row.attempt === "number" && Number.isInteger(row.attempt) && row.attempt >= 0
      ? row.attempt
      : null;
  if (fingerprint === "" || attempt === null) return null;
  return { fingerprint, attempt };
}

/**
 * The rows, or `null` when the store could not be read at all.
 *
 * The distinction is the whole safety of this record, exactly as it is on the
 * VAS side: `[]` is a fact — no payout has ever been retired — and a keychain
 * that merely refused to answer must never be allowed to say it. Nothing is
 * cached on failure either, or one bad read becomes the answer for the launch.
 */
async function readAttempts(): Promise<WithdrawalAttempt[] | null> {
  if (attemptMemory) return attemptMemory;
  if (isWeb) {
    attemptMemory = [];
    return attemptMemory;
  }
  try {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY, STORE_OPTIONS);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    attemptMemory = Array.isArray(parsed)
      ? parsed.map(readAttemptRow).filter((row): row is WithdrawalAttempt => row !== null)
      : [];
    return attemptMemory;
  } catch {
    return null;
  }
}

async function saveAttempts(list: WithdrawalAttempt[]): Promise<void> {
  const trimmed = list.slice(-ATTEMPT_LIMIT);
  attemptMemory = trimmed;
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify(trimmed), STORE_OPTIONS);
  } catch {
    // The memory copy still holds for this launch.
  }
}

/**
 * The attempt a NEW payout with this fingerprint belongs to.
 *
 * An unreadable store reads as attempt 0 on purpose: that answer re-sends the
 * SAME key rather than minting a second one, and a replayed request costs a
 * wasted round trip where a second key costs a second transfer.
 */
async function currentAttempt(fingerprint: string): Promise<number> {
  const list = await readAttempts();
  return list?.find((row) => row.fingerprint === fingerprint)?.attempt ?? 0;
}

async function rememberAttempt(fingerprint: string, attempt: number): Promise<void> {
  const list = await readAttempts();
  // Unreadable: this payout goes out without a row, which is exactly the
  // behaviour this module had before the row existed. Writing anyway would
  // persist a list that was never loaded and drop every other fingerprint's
  // attempt back to 0 — handing each of them a spent key.
  if (!list) return;
  if (list.some((row) => row.fingerprint === fingerprint && row.attempt === attempt)) return;
  await saveAttempts([
    ...list.filter((row) => row.fingerprint !== fingerprint),
    { fingerprint, attempt },
  ]);
}

/**
 * The attempt reserved under `slot` is over and can never be resumed.
 *
 * Matched by slot rather than by fingerprint so it is a no-op for anything that
 * is not the CURRENT attempt — a settle landing late cannot push the counter
 * past an attempt that is still in the air. A record written before payouts
 * carried an attempt at all reserved the bare stem, which no derived slot ever
 * equals, so it simply matches nothing.
 */
async function closeWithdrawalAttempt(slot: string): Promise<void> {
  const list = await readAttempts();
  if (!list) return;
  await saveAttempts(
    list.map((row) =>
      slotFor(row.fingerprint, row.attempt) === slot ? { ...row, attempt: row.attempt + 1 } : row,
    ),
  );
}

/* ------------------------------------------------- in-flight payout record */

/**
 * What is remembered about a payout between "we sent the request" and "we know
 * what happened to it".
 *
 * Deliberately thin on the person: the destination is kept as its last four
 * digits, which is enough to recognise the row in a list and to show the user
 * which transfer is being talked about, and not enough to be a stored record of
 * somebody's bank account.
 */
export interface PendingWithdrawal {
  /**
   * The slot the key was reserved under — carried here so that whoever ends
   * this operation releases THAT slot, not whichever slot the payout in front
   * of them happens to derive. The screen that reserved it may be long gone.
   */
  slot: string;
  idempotencyKey: string;
  /**
   * The payout fingerprint the slot was derived from.
   *
   * Carried so that "is this record the payout in front of me?" is decided on
   * the SAME field set the key was derived from. Deciding it on the destination
   * tail while the key hashes the full digits means two accounts at one bank
   * that share a last-4 are one payout for resume and two for the key — the
   * record gets adopted and a second key gets minted for it.
   *
   * Absent on records written before payouts carried one.
   */
  fingerprint?: string;
  amountMinor: string;
  currency: string;
  destinationLast4: string;
  destinationBankUuid: string;
  bankName?: string;
  accountName?: string;
  /** Epoch ms — the floor for matching a row back to this attempt. */
  startedAt: number;
  /** Set as soon as the gateway hands one back. */
  withdrawalId?: string;
}

const PENDING_KEY = "paradigm.linkpay.pending_withdrawal";
let pendingMemory: PendingWithdrawal | null = null;

export async function savePendingWithdrawal(record: PendingWithdrawal): Promise<void> {
  pendingMemory = record;
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(record), STORE_OPTIONS);
  } catch {
    // Memory copy carries the launch.
  }
}

export async function loadPendingWithdrawal(): Promise<PendingWithdrawal | null> {
  if (pendingMemory) return pendingMemory;
  if (isWeb) return null;
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY, STORE_OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingWithdrawal;
    if (typeof parsed?.idempotencyKey !== "string") return null;
    // A record written before payouts carried their own slot was reserved
    // under the bare stem, so that is where its key still lives. Backfilling
    // it here is what lets an upgrade release the old key instead of orphaning
    // it in the keychain forever.
    const record: PendingWithdrawal = {
      ...parsed,
      slot: typeof parsed.slot === "string" && parsed.slot !== "" ? parsed.slot : WITHDRAWAL_SLOT,
    };
    pendingMemory = record;
    return record;
  } catch {
    return null;
  }
}

export async function clearPendingWithdrawal(): Promise<void> {
  pendingMemory = null;
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(PENDING_KEY, STORE_OPTIONS);
  } catch {
    // Nothing to do.
  }
}

/**
 * Drop every trace of this account's payout and provisioning state.
 *
 * Sign-out only, and nothing else may call it: these records exist precisely to
 * survive a crash, a relaunch and a timeout, so anything that clears them
 * mid-flow reintroduces the double-send they prevent. But they are per-user,
 * and the keychain is per-device — without this, the next account signed in on
 * the same handset inherits the previous one's in-flight payout record (amount,
 * destination tail, bank, idempotency key) and the confirm screen narrates it
 * as their own.
 *
 * The keychain cannot be enumerated, so slots are gathered rather than listed:
 * the two fixed ones, everything this process has reserved, and every slot the
 * attempt ledger implies — a fingerprint sitting at attempt N has had a slot for
 * each attempt up to N, and any of them may still hold a key.
 */
export async function forgetPayoutState(): Promise<void> {
  const slots = new Set<string>([
    PROVISION_SLOT,
    WITHDRAWAL_SLOT,
    ...memoryKeys.keys(),
  ]);

  const ledger = await readAttempts();
  for (const row of ledger ?? []) {
    for (let attempt = 0; attempt <= row.attempt; attempt += 1) {
      slots.add(slotFor(row.fingerprint, attempt));
    }
  }

  // Each release swallows its own failure, so one unreadable slot cannot
  // abandon the rest of the sweep.
  await Promise.all([...slots].map((slot) => releaseIdempotencyKey(slot)));
  await clearPendingWithdrawal();

  attemptMemory = null;
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(ATTEMPTS_KEY, STORE_OPTIONS);
  } catch {
    // The memory mirror is already gone; a stale ledger row only costs the next
    // identical payout a fresh attempt number, which is the safe direction.
  }
}

/**
 * What the scan ASKS for per page, and how many pages it will walk.
 *
 * `FIND_PAGE` is a request, never an assumption: a gateway is free to cap its
 * own page below it (10 and 25 are the common caps), so nothing below infers
 * anything from a page that came back shorter than this. The cursor advances by
 * the rows actually returned for the same reason.
 */
const FIND_PAGE = 20;
const FIND_MAX_PAGES = 5;

export interface PendingLookup {
  /** The payout, when a row matched. */
  withdrawal: Withdrawal | null;
  /**
   * Whether `withdrawal: null` is evidence the gateway does not have it.
   *
   * "I looked and did not find it" and "it never happened" are different
   * sentences, and only the second one may release a key. The scan earns the
   * second only when it walked the feed back past this attempt's own floor (or
   * ran out of feed) AND could read every figure it walked past. A window that
   * stopped short, a row whose amount would not parse, a row with no readable
   * date, or a feed that paged in a shape the scan did not recognise all leave a
   * payout the scan cannot rule out — and the key is the only thing standing
   * between that payout and a second debit.
   */
  conclusive: boolean;
}

/**
 * Find the payout a timed-out request may already have created.
 *
 * This is what "a timeout is not a failure" looks like in practice: instead of
 * asking again with a new key, ask the gateway what it already has. Matching is
 * amount + destination tail + "created no earlier than we started", which is
 * tight enough that two different payouts cannot be confused unless the user
 * sent the identical amount to the identical account inside the same minute —
 * in which case the idempotency key would have collapsed them anyway.
 *
 * The scan walks back until the feed is older than this attempt could be, so a
 * busy account cannot push the row it is looking for out of the window and turn
 * a live transfer into "never sent". It walks a bounded number of pages, and
 * says so rather than pretending, when the bound runs out first.
 */
export async function findPendingWithdrawal(
  record: PendingWithdrawal,
  call: Call = {},
): Promise<PendingLookup> {
  const floor = record.startedAt - 60_000;
  // Every in-window row so far was either matched or positively ruled out. One
  // the scan could not read is one it cannot swear is somebody else's.
  let cleared = true;
  // The cursor moves by the rows actually returned, never by the page size that
  // was asked for. A gateway that caps its own page at 10 while this asks for
  // 20 would otherwise have rows 10-19 skipped over entirely — and a scan that
  // never looked at a row must not be allowed to reach a terminator and call
  // the payout absent.
  let skip = 0;
  let previousFirstId: string | null = null;

  for (let page = 0; page < FIND_MAX_PAGES; page += 1) {
    const feed = await listWithdrawals({ skip, take: FIND_PAGE }, call);
    const rows = feed.items;

    // The one shape of "the end of the feed" that is a fact rather than an
    // inference: nothing came back at all. A SHORT page is not that — it is
    // what a server-side cap under FIND_PAGE looks like on page one, and a
    // bare-array feed (which `readPage` reports as total = its own length)
    // looks the same again. Reading either as exhaustion is how a payout
    // sitting at index 25 becomes a confident "this never happened", and a
    // confident negative is what authorises retiring a live key.
    if (rows.length === 0) return { withdrawal: null, conclusive: cleared };

    // The same page twice means `skip` is not being honoured, so walking on
    // would re-read the newest rows forever while swearing it went deeper.
    const firstId = rows[0]?.id ?? "";
    if (firstId !== "" && firstId === previousFirstId) {
      return { withdrawal: null, conclusive: false };
    }
    previousFirstId = firstId;

    let oldestSeen: number | null = null;
    let descending = true;
    for (const withdrawal of rows) {
      const createdMs = toMillis(withdrawal.createdAt);
      if (createdMs !== null) {
        if (oldestSeen !== null && createdMs > oldestSeen) descending = false;
        oldestSeen = createdMs;
      }
      // Created before this attempt could have created it: not this payout, and
      // not a row the scan has to account for either.
      if (createdMs !== null && createdMs < floor) continue;

      const destination = withdrawal.destinationAccount;
      // Money that went to a different account is not this payout, whatever
      // else the row carries.
      if (destination !== undefined && !destination.endsWith(record.destinationLast4)) continue;

      if (createdMs === null) {
        // Undated, and to an account that could be this one. A row that cannot
        // be placed in time cannot be placed on the near side of the floor
        // either, so it may not have it both ways: skipping the floor test and
        // still being eligible to match on amount + destination alone is how a
        // settled payout from last month is adopted as this attempt's, its key
        // retired while this money may still be moving, and its reference
        // printed as this transfer's receipt. Unreadable is refused here for
        // the same reason an unreadable amount is refused below — and, like
        // that one, it costs the scan its right to a negative.
        cleared = false;
        continue;
      }
      if (destination === undefined || withdrawal.id === "" || !withdrawal.amount) {
        // In the window, and nothing on it rules it out: no destination to
        // compare, no reference to name it by, or a figure that would not parse
        // — "5000.00" is not minor units and guessing at it is the guess that
        // loses money. It is never matched on, but it does cost this scan the
        // right to say the payout is not there.
        cleared = false;
        continue;
      }
      if (withdrawal.amount.amountMinor !== record.amountMinor) continue;
      return { withdrawal, conclusive: true };
    }

    // A total is only evidence of exhaustion when it is bigger than the page it
    // arrived with. `readPage` synthesises `total = raw.length` for a bare
    // array, which is indistinguishable from a real total that happens to equal
    // this page's row count — so that case is left to the empty page above,
    // which costs one extra request and cannot be wrong.
    if (feed.total !== null && feed.total > rows.length && skip + rows.length >= feed.total) {
      return { withdrawal: null, conclusive: cleared };
    }
    // Newest first — checked rather than assumed, because a feed that came back
    // oldest-first would otherwise let page one end the scan before it started.
    // This is the normal exit: the feed is now older than this attempt can be.
    if (descending && oldestSeen !== null && oldestSeen < floor) {
      return { withdrawal: null, conclusive: cleared };
    }
    skip += rows.length;
  }
  return { withdrawal: null, conclusive: false };
}

/* ----------------------------------------------------------------- polling */

interface PollOptions {
  /** Gap between attempts. The gateway allows 120 requests a window. */
  intervalMs?: number;
  /** Give up after this long and leave the caller on its last known state. */
  maxMs?: number;
  onError?: (error: unknown) => void;
  /**
   * The poll stopped on its own — it reached the end of the thing it was
   * watching, hit `maxMs`, or lost the session. NOT called when the caller
   * stops it, because the caller already knows.
   *
   * A screen that says "watching your transfer" has to hear this: a spinner
   * over someone's money that nothing is actually feeding is a lie, not a
   * cosmetic problem.
   */
  onStopped?: () => void;
}

/**
 * Poll until `tick` says stop, the caller stops it, or `maxMs` elapses.
 *
 * A 429 is obeyed rather than fought: the gateway's own `Retry-After` sets the
 * next gap. Anything else that throws is reported and retried at the normal
 * cadence, because a status poll that dies on one flaky response leaves a
 * transfer looking stuck when it isn't.
 */
function startPolling(
  tick: (signal: AbortSignal) => Promise<boolean>,
  options: PollOptions = {},
): () => void {
  const interval = options.intervalMs ?? 4_000;
  const deadline = Date.now() + (options.maxMs ?? 5 * 60 * 1000);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  // `self` marks the stops the poll decides on itself, which are the ones the
  // caller has not heard about yet.
  const stop = (self = false) => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    controller.abort();
    if (self) options.onStopped?.();
  };

  const run = async () => {
    if (stopped) return;
    let next = interval;
    try {
      if (await tick(controller.signal)) return stop(true);
    } catch (error) {
      if (stopped) return;
      if (SessionExpiredError.is(error)) {
        options.onError?.(error);
        return stop(true);
      }
      if (ApiError.is(error) && error.statusCode === 429) {
        next = Math.max(interval, error.retryAfterMs ?? interval * 2);
      }
      options.onError?.(error);
    }
    if (stopped || Date.now() + next > deadline) return stop(true);
    timer = setTimeout(() => void run(), next);
  };

  void run();
  return () => stop();
}

/**
 * Watch one payout to a terminal state. Returns the stop function — call it
 * from the effect's cleanup so a backgrounded screen stops asking.
 */
export function watchWithdrawal(
  id: string,
  onUpdate: (withdrawal: Withdrawal) => void,
  options: PollOptions = {},
): () => void {
  return startPolling(async (signal) => {
    const withdrawal = await getWithdrawal(id, { signal });
    onUpdate(withdrawal);
    return isTerminalTransfer(withdrawal.status);
  }, options);
}

/**
 * Watch the deposit feed while the user is looking at their account number.
 *
 * `onUpdate` receives the whole recent page every tick; the caller decides what
 * is new. Stops when `isDone` says the deposit it was waiting for has credited.
 */
export function watchDeposits(
  onUpdate: (deposits: Deposit[]) => boolean,
  options: PollOptions = {},
): () => void {
  return startPolling(async (signal) => {
    const page = await listDeposits({ skip: 0, take: 10 }, { signal });
    return onUpdate(page.items);
  }, options);
}

/* ------------------------------------------------- the payout, past a screen */

/**
 * A payout outlives the screen that started it.
 *
 * The confirm screen invites the user to leave while the bank still has the
 * money — so the poll that decides when the key may be dropped cannot live on
 * that screen's lifetime. If it did, walking away one second before the
 * transfer settled would leave the key reserved forever, and the next payout
 * would inherit it.
 *
 * So the poll lives here. Screens subscribe while they are mounted and
 * unsubscribe when they are not; the tracker keeps going either way, and the
 * moment the payout is terminal — the one moment it can no longer be resumed —
 * it releases that payout's key and clears its record.
 *
 * When it gives up before that, it says so out loud (`stopped`) rather than
 * leaving a screen narrating a transfer nobody is watching. The key and the
 * record survive that, deliberately: the operation is still resumable, and the
 * key is the only thing that stops the resume from paying twice.
 */
export type WithdrawalWatchEvent =
  /** A fresh, non-terminal status. */
  | { kind: "update"; withdrawal: Withdrawal }
  /** Terminal. The key is released and the record is cleared by the time this lands. */
  | { kind: "settled"; withdrawal: Withdrawal }
  /** One failed status check. The payout is unaffected. */
  | { kind: "error"; error: unknown }
  /** Nobody is watching any more, and the payout had not finished. */
  | { kind: "stopped" };

type WithdrawalWatcher = (event: WithdrawalWatchEvent) => void;

interface Tracked {
  id: string;
  latest: Withdrawal | null;
  /** Terminal seen — suppresses the `stopped` the poll fires on its way out. */
  done: boolean;
  stop: () => void;
}

/** Ten minutes: longer than a NIP transfer, short of polling a dead app forever. */
const TRACK_MAX_MS = 10 * 60 * 1000;

const watchers = new Set<WithdrawalWatcher>();
let tracked: Tracked | null = null;

function broadcast(event: WithdrawalWatchEvent): void {
  // Copied first: a listener that unsubscribes on `settled` must not shorten
  // the set the loop is walking.
  for (const watcher of [...watchers]) watcher(event);
}

/**
 * Hear about the payout being tracked. Returns the unsubscribe — call it from
 * the effect's cleanup. Unsubscribing does NOT stop the tracker.
 */
export function subscribeToWithdrawal(watcher: WithdrawalWatcher): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

/** The payout currently being tracked, and its last known state. */
export function trackedWithdrawal(): { id: string; latest: Withdrawal | null } | null {
  return tracked ? { id: tracked.id, latest: tracked.latest } : null;
}

/**
 * Follow `withdrawalId` to a terminal state and retire `record` when it gets
 * there. Idempotent: asking again for the payout already being tracked adopts
 * that poll rather than starting a second one.
 */
export function trackWithdrawal(record: PendingWithdrawal, withdrawalId: string): void {
  if (withdrawalId === "") return;
  if (tracked && tracked.id === withdrawalId) return;
  tracked?.stop();

  const entry: Tracked = { id: withdrawalId, latest: null, done: false, stop: () => {} };
  tracked = entry;

  entry.stop = watchWithdrawal(
    withdrawalId,
    (next) => {
      entry.latest = next;
      if (!isTerminalTransfer(next.status)) {
        broadcast({ kind: "update", withdrawal: next });
        return;
      }
      entry.done = true;
      void (async () => {
        await retireWithdrawal(record);
        if (tracked === entry) tracked = null;
        broadcast({ kind: "settled", withdrawal: next });
      })();
    },
    {
      intervalMs: 4_000,
      maxMs: TRACK_MAX_MS,
      onError: (error) => broadcast({ kind: "error", error }),
      onStopped: () => {
        if (entry.done) return;
        if (tracked === entry) tracked = null;
        broadcast({ kind: "stopped" });
      },
    },
  );
}

/**
 * Retire a payout: drop its key, drop its record.
 *
 * Two callers only, and they are the same statement said two ways — the
 * operation this record names can no longer be resumed. Either it reached a
 * terminal state, or the gateway never took it AND the user is now asking for
 * something else. A timeout is neither, and neither is leaving the screen.
 */
export async function retireWithdrawal(record: PendingWithdrawal): Promise<void> {
  // The attempt moves on BEFORE the key is dropped, in the sibling's order and
  // for the sibling's reason: a keychain that silently refuses the delete must
  // still not be able to hand this spent key to the next payout with the same
  // details. The retired slot is simply never asked for again.
  await closeWithdrawalAttempt(record.slot);
  await releaseIdempotencyKey(record.slot);
  const current = await loadPendingWithdrawal();
  // Only clear the record if it is still this payout's. A settle that lands
  // late must not wipe the record of a payout that started after it.
  if (!current || current.idempotencyKey === record.idempotencyKey) {
    await clearPendingWithdrawal();
  }
}

/**
 * Stop BLOCKING on a payout that can be neither resolved nor resumed — without
 * claiming it never happened.
 *
 * "What became of the old payout?" and "may the user start a new one?" are two
 * questions, and only the first one is unanswerable here. A record with no
 * withdrawalId (nothing to ask the gateway by) whose feed rows will not read
 * (nothing to scan by) can never earn a conclusive negative, so it can never be
 * retired — correctly, because retiring it is exactly the release that sends a
 * live payout twice. But leaving it as the one pending record also wedges the
 * payout feature for good: every later confirm lands back on its panel.
 *
 * So this releases NOTHING. The key stays in the keychain and the attempt
 * counter for that payout's fingerprint moves PAST the stuck attempt, which is
 * the whole of the guarantee: the next payout with the same details derives
 * `.n+1`, is minted a key of its own, and can never be handed this one. Only
 * then is the record cleared, so a new operation has the pending slot.
 *
 * Answers `false` — and changes nothing — when it cannot prove that guarantee:
 * an unreadable ledger would answer attempt `0` for this fingerprint too, and a
 * ledger write that never reached the keychain dies with the app. In both cases
 * the next identical payout would derive THIS slot and be handed THIS key, so
 * the honest answer is that the record has to stay where it is.
 */
export async function setAsideWithdrawal(record: PendingWithdrawal): Promise<boolean> {
  const derived = parseWithdrawalSlot(record.slot);
  if (derived) {
    const list = await readAttempts();
    if (!list) return false;
    const row = list.find((entry) => entry.fingerprint === derived.fingerprint);
    // Never backwards: a counter already past this attempt stays where it is.
    const attempt = Math.max(derived.attempt + 1, row?.attempt ?? 0);
    await saveAttempts([
      ...list.filter((entry) => entry.fingerprint !== derived.fingerprint),
      { fingerprint: derived.fingerprint, attempt },
    ]);
    // `saveAttempts` keeps a memory copy when the keychain write fails, and a
    // memory copy dies with the app — after which `currentAttempt` answers with
    // the OLD number again. Read it back rather than trust it.
    if (!isWeb && !(await attemptPersisted(derived.fingerprint, attempt))) return false;
  }
  await clearPendingWithdrawal();
  return true;
}

/** Is the ledger on disk — not just the mirror — at least at `attempt`? */
async function attemptPersisted(fingerprint: string, attempt: number): Promise<boolean> {
  try {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY, STORE_OPTIONS);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    const stored = parsed
      .map(readAttemptRow)
      .find((entry): entry is WithdrawalAttempt => entry !== null && entry.fingerprint === fingerprint);
    return stored !== undefined && stored.attempt >= attempt;
  } catch {
    return false;
  }
}

export interface PendingOutcome {
  /** What the gateway has for this record, or `null` when it has nothing. */
  withdrawal: Withdrawal | null;
  /** Terminal — the key has been released and the record cleared. */
  retired: boolean;
  /**
   * Whether `withdrawal: null` may be read as "the gateway never took it".
   *
   * Only the id path earns this for free: a 404 for a reference the gateway
   * itself issued IS the gateway saying it has no such payout. A list scan that
   * simply did not match is `false` unless it walked back far enough to prove
   * absence — see `PendingLookup`. Callers must not retire a key on a `false`.
   */
  conclusive: boolean;
}

/**
 * What became of a payout we are holding a record for.
 *
 * Asks by id when the gateway gave us one, and by amount + destination tail +
 * "created no earlier than we started" when it did not. A terminal answer
 * retires the operation on the spot; anything else — live, never received, or
 * a lookup that threw — leaves the key and the record exactly where they are,
 * because in every one of those cases the payout is still resumable.
 */
export async function reconcilePendingWithdrawal(
  record: PendingWithdrawal,
  call: Call = {},
): Promise<PendingOutcome> {
  let found: Withdrawal | null;
  let conclusive: boolean;
  if (record.withdrawalId) {
    try {
      found = await getWithdrawal(record.withdrawalId, call);
      conclusive = true;
    } catch (error) {
      // A 404 is an answer, not a failure: the gateway does not have this
      // payout, and it is the only "not found" here that is authoritative.
      if (ApiError.is(error) && error.statusCode === 404) {
        found = null;
        conclusive = true;
      } else throw error;
    }
  } else {
    const lookup = await findPendingWithdrawal(record, call);
    found = lookup.withdrawal;
    conclusive = lookup.conclusive;
  }

  if (!found) return { withdrawal: null, retired: false, conclusive };
  // Answered, but with nothing that can be followed or matched again. That is
  // not the gateway saying the payout does not exist, so it may not retire one.
  if (found.id === "") return { withdrawal: null, retired: false, conclusive: false };
  if (record.withdrawalId !== found.id) {
    await savePendingWithdrawal({ ...record, withdrawalId: found.id });
  }
  if (!isTerminalTransfer(found.status)) {
    return { withdrawal: found, retired: false, conclusive: true };
  }

  await retireWithdrawal({ ...record, withdrawalId: found.id });
  return { withdrawal: found, retired: true, conclusive: true };
}

/**
 * What the next release of THIS payout must be sent under.
 *
 * The one distinction this function exists to make: a record already on disk
 * names an operation that may ALREADY BE IN FLIGHT at the gateway, and its key
 * is the key the gateway may be holding — so for a resume, the record's own
 * slot and key are authoritative and nothing is derived at all. Deriving a slot
 * for a payout that already has a key is how the same transfer goes out twice:
 * a record written before payouts derived their own slot sits under the bare
 * stem, and re-deriving would reserve an empty slot and mint a SECOND key for
 * money already moving.
 *
 * The derived slot governs a NEW operation only, and it carries the attempt
 * number so a payout the user deliberately repeats is a new operation rather
 * than a replay of the last identical one.
 *
 * `resume` is the caller's decision, because only the screen knows whether the
 * record in front of it is this payout or an earlier one.
 */
export interface WithdrawalPlan {
  slot: string;
  idempotencyKey: string;
  /** Undefined only for a resumed record written before payouts carried one. */
  fingerprint?: string;
  /** True when this replays an operation already reserved, not a new one. */
  resumed: boolean;
}

export async function planWithdrawal(
  payout: { amount: Money; accountNumber: string; bankUuid: string },
  resume: PendingWithdrawal | null,
): Promise<WithdrawalPlan> {
  if (resume) {
    return {
      slot: resume.slot,
      idempotencyKey: resume.idempotencyKey,
      fingerprint: resume.fingerprint,
      resumed: true,
    };
  }
  const fingerprint = withdrawalFingerprint(payout);
  const attempt = await currentAttempt(fingerprint);
  const slot = slotFor(fingerprint, attempt);
  // The row goes down before the key is reserved: a row with no key behind it
  // costs nothing, where a key with no row behind it is the one a later payout
  // with the same details walks into.
  await rememberAttempt(fingerprint, attempt);
  return {
    slot,
    fingerprint,
    idempotencyKey: await reserveIdempotencyKey(slot, "withdrawal"),
    resumed: false,
  };
}

/* ---------------------------------------------------------------- activity */

/**
 * One line of money movement, in or out.
 *
 * The two feeds are separate routes with separate shapes and separate status
 * machines, and merging them in a screen means every screen that wants a
 * statement re-derives "which of these happened first". This does it once and
 * keeps the entity intact — the copy stays the caller's business.
 */
export type ActivityEntry =
  | { kind: "deposit"; key: string; at: number | null; deposit: Deposit }
  | { kind: "withdrawal"; key: string; at: number | null; withdrawal: Withdrawal };

/**
 * The recent deposits and withdrawals as one list, newest first.
 *
 * Entries with no readable timestamp sort last rather than to the top: an
 * undated row claiming to be the most recent thing that happened to someone's
 * money is a worse lie than an undated row at the bottom.
 */
export async function listActivity(
  page: PageInfo = {},
  call: Call = {},
): Promise<ActivityEntry[]> {
  const take = page.take ?? 20;
  const [deposits, withdrawals] = await Promise.all([
    listDeposits({ skip: page.skip, take }, call),
    listWithdrawals({ skip: page.skip, take }, call),
  ]);

  const entries: ActivityEntry[] = [
    ...deposits.items.map((deposit, index) => ({
      kind: "deposit" as const,
      key: `deposit:${deposit.id || index}`,
      at: toMillis(deposit.creditedAt) ?? toMillis(deposit.createdAt),
      deposit,
    })),
    ...withdrawals.items.map((withdrawal, index) => ({
      kind: "withdrawal" as const,
      key: `withdrawal:${withdrawal.id || index}`,
      at: toMillis(withdrawal.createdAt),
      withdrawal,
    })),
  ];

  entries.sort((a, b) => (b.at ?? -Infinity) - (a.at ?? -Infinity));
  return entries.slice(0, take);
}

/** True once a deposit can no longer move — safe to stop watching for it. */
export function isTerminalDeposit(status: DepositStatus): boolean {
  return status === "CREDITED" || status === "REJECTED";
}

/** The last four digits of an account number, for matching a payout to a row. */
export function lastFour(accountNumber: string): string {
  return accountNumber.replace(/\D/g, "").slice(-4);
}

/**
 * A destination account as it should appear on screen: the tail only.
 *
 * Somebody's full account number does not need to be printed on a receipt to
 * make the receipt legible, and the four digits are what a person actually
 * checks against the number they typed.
 */
export function maskAccount(accountNumber: string | undefined): string {
  const digits = (accountNumber ?? "").replace(/\D/g, "");
  if (digits === "") return "—";
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}

/* ----------------------------------------------------------------- labels */

/** Wire status to something a person can read. `UNKNOWN` never blanks a row. */
export function depositStatusLabel(status: DepositStatus): string {
  switch (status) {
    case "DETECTED":
      return "Detected";
    case "CREDITED":
      return "Credited";
    case "REJECTED":
      return "Rejected";
    default:
      return "Unknown";
  }
}

export function withdrawalStatusLabel(status: TransferStatus): string {
  switch (status) {
    case "REQUESTED":
      return "Requested";
    case "SUBMITTED":
      return "Submitted";
    case "PROCESSING":
      return "Processing";
    case "SETTLED":
      return "Sent";
    case "DELIVERED":
      return "Delivered";
    case "FAILED":
      return "Failed";
    case "REVERSED":
      return "Reversed";
    default:
      return "Unknown";
  }
}

/** Account status as a person reads it. `UNKNOWN` says so rather than lying. */
export function accountStatusLabel(status: AccountStatus): string {
  switch (status) {
    case "PENDING_KYC":
      return "Verifying";
    case "CUSTOMER_CREATED":
      return "Almost ready";
    case "ACTIVE":
      return "Active";
    case "DISABLED":
      return "Disabled";
    case "PROVISION_FAILED":
      return "Could not be opened";
    default:
      return "Unknown";
  }
}

/**
 * One line a person can act on.
 *
 * Gateway 5xx text is written for operators ("User Management service is
 * unavailable" is a real body from api.tsion.io), so it is replaced wholesale.
 * 4xx text is passed through — for a rejected BVN or a bad account number, the
 * specific reason is the useful part. Entitlement and session failures get no
 * copy at all: those are routing decisions, and the caller must branch on
 * `isEntitlementError` / `SessionExpiredError` before reaching this.
 */
export function describeLinkpayFailure(error: unknown): string {
  if (NetworkError.is(error)) {
    return error.timedOut
      ? "That took too long to answer. Check the status before trying again."
      : "Could not reach Paradigm. Check your connection.";
  }
  if (isEntitlementError(error)) {
    return "Your Paradigm subscription is not active.";
  }
  if (ApiError.is(error)) {
    if (error.statusCode === 429) return "Too many requests. Give it a moment.";
    if (error.statusCode === 409) {
      return "That request was already made with different details. Start it again.";
    }
    if (error.statusCode >= 500) {
      return "Paradigm is temporarily unavailable. Try again shortly.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}
