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

/**
 * Read a money value in whichever shape it arrives: nested (`{amountMinor,
 * currency}`), split across sibling fields, or a bare minor-unit string beside
 * a currency somewhere else.
 *
 * A JSON *number* is accepted only when it is an integer, and never converted
 * from a decimal. `100.5` as a number would be a gateway bug, and guessing
 * whether it meant ₦1.005 or ₦100.50 is exactly the guess that loses money —
 * so it reads as absent and the row renders an em dash instead of a lie.
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
    return { amountMinor: value.trim(), currency };
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
  return amountMinor ? { amountMinor, currency } : undefined;
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
/** Slot for the payout currently being confirmed. */
export const WITHDRAWAL_SLOT = "linkpay.withdrawal";

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
  idempotencyKey: string;
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
    pendingMemory = parsed;
    return parsed;
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
 * Find the payout a timed-out request may already have created.
 *
 * This is what "a timeout is not a failure" looks like in practice: instead of
 * asking again with a new key, ask the gateway what it already has. Matching is
 * amount + destination tail + "created no earlier than we started", which is
 * tight enough that two different payouts cannot be confused unless the user
 * sent the identical amount to the identical account inside the same minute —
 * in which case the idempotency key would have collapsed them anyway.
 */
export async function findPendingWithdrawal(
  record: PendingWithdrawal,
  call: Call = {},
): Promise<Withdrawal | null> {
  const page = await listWithdrawals({ skip: 0, take: 20 }, call);
  const floor = record.startedAt - 60_000;

  for (const withdrawal of page.items) {
    if (withdrawal.id === "") continue;
    if (withdrawal.amount?.amountMinor !== record.amountMinor) continue;
    const destination = withdrawal.destinationAccount ?? "";
    if (!destination.endsWith(record.destinationLast4)) continue;
    const createdMs = toMillis(withdrawal.createdAt);
    if (createdMs !== null && createdMs < floor) continue;
    return withdrawal;
  }
  return null;
}

/* ----------------------------------------------------------------- polling */

interface PollOptions {
  /** Gap between attempts. The gateway allows 120 requests a window. */
  intervalMs?: number;
  /** Give up after this long and leave the caller on its last known state. */
  maxMs?: number;
  onError?: (error: unknown) => void;
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

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    controller.abort();
  };

  const run = async () => {
    if (stopped) return;
    let next = interval;
    try {
      if (await tick(controller.signal)) return stop();
    } catch (error) {
      if (stopped) return;
      if (SessionExpiredError.is(error)) {
        options.onError?.(error);
        return stop();
      }
      if (ApiError.is(error) && error.statusCode === 429) {
        next = Math.max(interval, error.retryAfterMs ?? interval * 2);
      }
      options.onError?.(error);
    }
    if (stopped || Date.now() + next > deadline) return stop();
    timer = setTimeout(() => void run(), next);
  };

  void run();
  return stop;
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
