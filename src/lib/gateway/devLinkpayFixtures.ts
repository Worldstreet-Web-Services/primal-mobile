/**
 * Dev-only LinkPay fixtures — a local answer for every `/v1/linkpay/*` route,
 * so the naira surface (fiat, KYC, fund, send, bills) can be exercised while
 * the backend's Subscription service is down and nothing can buy the
 * entitlement those routes sit behind.
 *
 * WHAT THIS IS, AND IS NOT:
 * - On only when `__DEV__` AND `EXPO_PUBLIC_DEV_LINKPAY_FIXTURES` is set
 *   (see `devMode.ts`). In a release build this file is a no-op by
 *   construction — the flag it checks cannot be true there.
 * - `/v1/auth/*` and `/v1/subscriptions/*` are NEVER intercepted. Auth and
 *   checkout stay live and real, so the payment flow remains provable end to
 *   end the moment the backend is fixed.
 * - Every value labels itself as fake. Account name "FIXTURE — NOT A REAL
 *   ACCOUNT", bank "Paradigm Test Bank", account number "0000000000", payer
 *   "Fixture Deposit", narration "fixture". Never a plausible NUBAN, never a
 *   plausible person — this app has already had to strip fabricated numbers
 *   people could copy and pay a stranger with.
 * - Shapes match the integration contract the readers in `linkpay.ts` /
 *   `services.ts` were written against: money is integer minor units in
 *   STRINGS, entities arrive in envelopes (`{account: …}`, `{withdrawal: …}`),
 *   lists arrive as `{items, total, skip, take}` pages or bare arrays, and
 *   statuses come from the documented unions in `types.ts`.
 *
 * ENTITLEMENT: `probeEntitlement` probes `GET /v1/linkpay/account`; with
 * fixtures on it gets a real-shaped answer, so the app reads as entitled and
 * the paywall gate passes. That is correct and desired — do not special-case.
 *
 * STATE MACHINE (module-scope, dies with the JS runtime — reload to reset):
 * - Provisioning: `POST /accounts` creates the account in PENDING_KYC; it
 *   becomes ACTIVE ~6s later. On activation the balance seeds at ₦250,000.00
 *   ("25000000" kobo) via one CREDITED fixture deposit, so the activity feed
 *   has content and the balance provably adds up.
 * - Withdrawals: the POST answers SUBMITTED; its GET advances to PROCESSING
 *   after ~2.5s and SETTLED after ~7s. The balance is debited amount + fee
 *   (fee = 1% via BigInt, no float math) at POST time, so an in-session
 *   overdraw is refused with a 400 instead of passing silently.
 * - VAS purchases: the POST answers SUBMITTED; PROCESSING after ~2.5s,
 *   DELIVERED after ~6s. Electricity purchases deliver a serviceToken
 *   "FIXTURE-TOKEN-0000-0000" (only once DELIVERED). Amount debited at POST.
 * - Idempotency: re-POSTing the SAME `idempotencyKey` returns the SAME entity
 *   in its CURRENT state; a new key makes a new one. The screens' double-send
 *   defences are part of what this layer exists to test.
 *
 * FAILURE + LATENCY KNOBS (documented here on purpose):
 * - Every answer waits ~250–600ms (random), so loading states render.
 * - 503 trigger: a withdrawal POST whose narration is exactly "fixture-fail"
 *   answers 503 ONCE per idempotency key; the retry with the same key
 *   succeeds. Note the fixture seam sits ahead of the client's own retry
 *   loop, so the 503 surfaces to the calling screen — it exercises the
 *   screen-level retry path, not `dispatch()`'s backoff.
 *
 * Any `/v1/linkpay/*` path with no handler here answers 404 (never falls
 * through to the network, which would 403 mid-test and muddy the water).
 * Every answer is traced through `client.ts`'s `trace()` with a FIXTURE
 * marker, so the Metro log cannot be mistaken for live traffic.
 */

import { linkpayFixtures } from "../devMode";
import { ApiError } from "./types";

/* ---------------------------------------------------------------- plumbing */

type Query = Record<string, string | number | boolean | null | undefined>;
type Trace = (message: string, detail: Record<string, unknown>) => void;

interface Answer {
  status: number;
  body?: unknown;
  /** Error text for the gateway-shaped envelope when `status` >= 400. */
  message?: string;
}

const LATENCY_MIN_MS = 250;
const LATENCY_JITTER_MS = 350;
const PROVISION_ACTIVE_AFTER_MS = 6_000;
const WITHDRAWAL_PROCESSING_AFTER_MS = 2_500;
const WITHDRAWAL_SETTLED_AFTER_MS = 7_000;
const PURCHASE_PROCESSING_AFTER_MS = 2_500;
const PURCHASE_DELIVERED_AFTER_MS = 6_000;

/** ₦250,000.00 in kobo. The one figure everything below must reconcile to. */
const SEED_BALANCE_MINOR = 25_000_000n;

const CURRENCY = "NGN";
const FIXTURE_ACCOUNT_NAME = "FIXTURE — NOT A REAL ACCOUNT";
const FIXTURE_BANK_NAME = "Paradigm Test Bank";
const FIXTURE_RECIPIENT = "FIXTURE RECIPIENT";
const FIXTURE_TOKEN = "FIXTURE-TOKEN-0000-0000";
const FAIL_NARRATION = "fixture-fail";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const iso = (ms: number): string => new Date(ms).toISOString();

const money = (amountMinor: bigint) => ({
  amountMinor: amountMinor.toString(),
  currency: CURRENCY,
});

const rec = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};

const strOf = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

/** Integer minor units from a wire value — string or integer number only. */
function minorOf(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return BigInt(value.trim());
  return null;
}

/** Mirrors `carriesIdempotencyKey` in client.ts: 8+ chars or it is not a key. */
function keyOf(body: unknown): string | null {
  const key = rec(body).idempotencyKey;
  return typeof key === "string" && key.length >= 8 ? key : null;
}

function pageOf(items: unknown[], query: Query): Answer {
  const num = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };
  const skip = num(query.skip) ?? 0;
  const take = num(query.take) ?? items.length;
  return {
    status: 200,
    body: { items: items.slice(skip, skip + take), total: items.length, skip, take },
  };
}

const ok = (body: unknown): Answer => ({ status: 200, body });
const err = (status: number, message: string): Answer => ({ status, message });

/* -------------------------------------------------------------------- state */

interface FixtureDeposit {
  id: string;
  amountMinor: bigint;
  createdAtMs: number;
}

interface FixtureWithdrawal {
  id: string;
  createdAtMs: number;
  amountMinor: bigint;
  feeMinor: bigint;
  destinationAccount: string;
  destinationBankUuid: string;
  bankName: string;
  narration: string | null;
  reference: string;
}

interface FixturePurchase {
  id: string;
  createdAtMs: number;
  amountMinor: bigint;
  serviceType: string;
  serviceCategory: string;
  serviceProviderId: string;
  serviceProviderName: string;
  serviceProductCode: string | null;
  destinationIdentifier: string;
  narration: string | null;
  reference: string;
  /** Electricity delivers a token; airtime and data do not. */
  withToken: boolean;
}

const state = {
  account: null as { provisionKey: string; createdAtMs: number } | null,
  /** Set once the activation side effects (seed deposit + balance) have run. */
  seeded: false,
  balanceMinor: 0n,
  deposits: [] as FixtureDeposit[],
  /** Newest first — `findPendingWithdrawal` expects a descending feed. */
  withdrawals: [] as FixtureWithdrawal[],
  purchases: [] as FixturePurchase[],
  withdrawalByKey: new Map<string, string>(),
  purchaseByKey: new Map<string, string>(),
  /** Idempotency keys that have already been paid their one 503. */
  failedOnce: new Set<string>(),
  counter: 0,
};

const nextId = (stem: string): string => {
  state.counter += 1;
  return `fixture-${stem}-${String(state.counter).padStart(4, "0")}`;
};

function accountStatus(now: number): "PENDING_KYC" | "ACTIVE" {
  if (!state.account) return "PENDING_KYC";
  return now - state.account.createdAtMs >= PROVISION_ACTIVE_AFTER_MS
    ? "ACTIVE"
    : "PENDING_KYC";
}

/** Run the activation side effects exactly once, lazily, on any read. */
function settleClock(now: number): void {
  if (!state.account || state.seeded || accountStatus(now) !== "ACTIVE") return;
  state.seeded = true;
  state.balanceMinor = SEED_BALANCE_MINOR;
  state.deposits.unshift({
    id: nextId("dep"),
    amountMinor: SEED_BALANCE_MINOR,
    createdAtMs: now,
  });
}

/* -------------------------------------------------------------- wire shapes */

function wireAccount(now: number): Record<string, unknown> {
  const created = state.account?.createdAtMs ?? now;
  const status = accountStatus(now);
  return {
    id: "fixture-account-0001",
    status,
    // The account number only exists once provisioning has finished — and it
    // is all zeros on purpose: nobody can copy it into a real transfer.
    ...(status === "ACTIVE" ? { accountNumber: "0000000000" } : null),
    accountName: FIXTURE_ACCOUNT_NAME,
    bankName: FIXTURE_BANK_NAME,
    bankCode: "000000",
    currency: CURRENCY,
    country: "NG",
    createdAt: iso(created),
  };
}

function wireDeposit(deposit: FixtureDeposit): Record<string, unknown> {
  return {
    id: deposit.id,
    status: "CREDITED",
    amount: money(deposit.amountMinor),
    narration: "fixture",
    reference: `FIXTURE-REF-${deposit.id}`,
    senderName: "Fixture Deposit",
    senderBank: FIXTURE_BANK_NAME,
    createdAt: iso(deposit.createdAtMs),
    creditedAt: iso(deposit.createdAtMs),
  };
}

function withdrawalStatus(w: FixtureWithdrawal, now: number): string {
  const elapsed = now - w.createdAtMs;
  if (elapsed < WITHDRAWAL_PROCESSING_AFTER_MS) return "SUBMITTED";
  if (elapsed < WITHDRAWAL_SETTLED_AFTER_MS) return "PROCESSING";
  return "SETTLED";
}

function wireWithdrawal(w: FixtureWithdrawal, now: number): Record<string, unknown> {
  const status = withdrawalStatus(w, now);
  return {
    id: w.id,
    status,
    amount: money(w.amountMinor),
    fee: money(w.feeMinor),
    totalDebit: money(w.amountMinor + w.feeMinor),
    destinationAccount: w.destinationAccount,
    destinationBankUuid: w.destinationBankUuid,
    accountName: FIXTURE_RECIPIENT,
    bankName: w.bankName,
    ...(w.narration ? { narration: w.narration } : null),
    reference: w.reference,
    createdAt: iso(w.createdAtMs),
    ...(status === "SETTLED"
      ? { settledAt: iso(w.createdAtMs + WITHDRAWAL_SETTLED_AFTER_MS) }
      : null),
  };
}

function purchaseStatus(p: FixturePurchase, now: number): string {
  const elapsed = now - p.createdAtMs;
  if (elapsed < PURCHASE_PROCESSING_AFTER_MS) return "SUBMITTED";
  if (elapsed < PURCHASE_DELIVERED_AFTER_MS) return "PROCESSING";
  return "DELIVERED";
}

function wireTransaction(p: FixturePurchase, now: number): Record<string, unknown> {
  const status = purchaseStatus(p, now);
  const delivered = status === "DELIVERED";
  return {
    transaction: {
      id: p.id,
      status,
      amount: money(p.amountMinor),
      fee: money(0n),
      totalDebit: money(p.amountMinor),
      serviceType: p.serviceType,
      serviceCategory: p.serviceCategory,
      serviceProviderId: p.serviceProviderId,
      serviceProviderName: p.serviceProviderName,
      ...(p.serviceProductCode ? { serviceProductCode: p.serviceProductCode } : null),
      destinationIdentifier: p.destinationIdentifier,
      ...(p.narration ? { narration: p.narration } : null),
      reference: p.reference,
      // A token is a bearer instrument, so even the fake one only exists once
      // the purchase is DELIVERED — exactly when the real gateway mints it.
      ...(delivered && p.withToken
        ? { serviceToken: FIXTURE_TOKEN, units: "0.0 kWh (fixture)" }
        : null),
      createdAt: iso(p.createdAtMs),
      updatedAt: iso(delivered ? p.createdAtMs + PURCHASE_DELIVERED_AFTER_MS : now),
    },
  };
}

/* ---------------------------------------------------------------- catalogue */

const BANKS = [
  { uuid: "fixture-bank-0001", name: FIXTURE_BANK_NAME, code: "000001", country: "NG", currency: CURRENCY },
  { uuid: "fixture-bank-0002", name: "Fixture Trust Bank", code: "000002", country: "NG", currency: CURRENCY },
  { uuid: "fixture-bank-0003", name: "Placeholder Microfinance Bank", code: "090000", country: "NG", currency: CURRENCY },
] as const;

/** Keyed by the lowercase `serviceType|category` pair the sweep probes with. */
const PROVIDERS: Record<string, readonly Record<string, unknown>[]> = {
  "airtime|airtime": [
    {
      id: "fixture-telco-airtime",
      name: "Fixture Telco",
      serviceType: "airtime",
      category: "airtime",
      country: "NG",
      requiresValidation: false,
    },
  ],
  "data|data": [
    {
      id: "fixture-telco-data",
      name: "Fixture Telco Data",
      serviceType: "data",
      category: "data",
      country: "NG",
      requiresValidation: false,
    },
  ],
  "bill_payment|electricity": [
    {
      id: "fixture-electric",
      name: "Fixture Electric",
      serviceType: "bill_payment",
      category: "electricity",
      country: "NG",
      requiresValidation: false,
    },
  ],
};

const PROVIDER_NAMES: Record<string, string> = {
  "fixture-telco-airtime": "Fixture Telco",
  "fixture-telco-data": "Fixture Telco Data",
  "fixture-electric": "Fixture Electric",
};

const PRODUCTS: Record<string, readonly Record<string, unknown>[]> = {
  "fixture-telco-airtime": [
    { code: "FIXTURE-AIRTIME-ANY", name: "Airtime top-up (fixture)", fixedAmount: false },
  ],
  "fixture-telco-data": [
    {
      code: "FIXTURE-DATA-1",
      name: "Fixture 1.5GB",
      amount: { amountMinor: "100000", currency: CURRENCY },
      dataSize: "1.5GB",
      validity: "30 days",
      fixedAmount: true,
    },
    {
      code: "FIXTURE-DATA-2",
      name: "Fixture 5GB",
      amount: { amountMinor: "250000", currency: CURRENCY },
      dataSize: "5GB",
      validity: "30 days",
      fixedAmount: true,
    },
  ],
  "fixture-electric": [
    { code: "FIXTURE-PREPAID", name: "Prepaid token (fixture)", fixedAmount: false },
  ],
};

/* ----------------------------------------------------------------- handlers */

function handleProvision(body: unknown, now: number): Answer {
  const key = keyOf(body);
  if (!key) return err(400, "idempotencyKey of at least 8 characters is required.");

  if (state.account) {
    // The SAME key is the same operation being resumed — answer with the
    // account as it stands. A NEW key cannot make a second account.
    if (state.account.provisionKey === key) return ok({ account: wireAccount(now) });
    return err(409, "A linkpay account already exists for this user. (fixture)");
  }

  const node = rec(body);
  for (const field of ["firstName", "lastName", "phoneNumber", "email", "bvn"]) {
    if (!strOf(node[field])) return err(400, `${field} is required.`);
  }

  state.account = { provisionKey: key, createdAtMs: now };
  return ok({ account: wireAccount(now) });
}

function handleQuote(body: unknown): Answer {
  const amount = minorOf(rec(rec(body)).amountMinor ?? rec(body).amountMinor);
  if (amount === null || amount <= 0n) {
    return err(400, "amountMinor must be a positive integer minor-unit string.");
  }
  const fee = amount / 100n; // 1%, BigInt integer division — no float math.
  return ok({
    quote: { fee: money(fee), totalDebit: money(amount + fee) },
  });
}

function handleWithdraw(body: unknown, now: number): Answer {
  const key = keyOf(body);
  if (!key) return err(400, "idempotencyKey of at least 8 characters is required.");

  // Idempotent replay: the same key is the same payout, whatever else changed.
  const existing = state.withdrawalByKey.get(key);
  if (existing) {
    const w = state.withdrawals.find((row) => row.id === existing);
    if (w) return ok({ withdrawal: wireWithdrawal(w, now) });
  }

  const node = rec(body);
  const amount = minorOf(rec(node.amount).amountMinor);
  const destinationAccount = strOf(node.destinationAccount);
  const destinationBankUuid = strOf(node.destinationBankUuid);
  const narration = strOf(node.narration);

  if (amount === null || amount <= 0n) {
    return err(400, "amount.amountMinor must be a positive integer minor-unit string.");
  }
  if (!destinationAccount || !destinationBankUuid) {
    return err(400, "destinationAccount and destinationBankUuid are required.");
  }
  const bank = BANKS.find((b) => b.uuid === destinationBankUuid);
  if (!bank) return err(404, "Unknown destination bank. (fixture)");
  if (!state.account || accountStatus(now) !== "ACTIVE") {
    return err(409, "No active linkpay account. (fixture)");
  }

  // The documented one-shot failure: narration "fixture-fail" answers 503 once
  // per key, so the screen's retry path can be walked deliberately.
  if (narration === FAIL_NARRATION && !state.failedOnce.has(key)) {
    state.failedOnce.add(key);
    return err(503, "Fixture: simulated provider outage. Retry with the same key succeeds.");
  }

  const fee = amount / 100n; // Matches the quote: 1% via BigInt.
  const totalDebit = amount + fee;
  if (totalDebit > state.balanceMinor) {
    return err(400, "Insufficient balance for amount plus fee. (fixture)");
  }

  state.balanceMinor -= totalDebit;
  const withdrawal: FixtureWithdrawal = {
    id: nextId("wd"),
    createdAtMs: now,
    amountMinor: amount,
    feeMinor: fee,
    destinationAccount,
    destinationBankUuid,
    bankName: bank.name,
    narration,
    reference: nextId("wd-ref").toUpperCase(),
  };
  state.withdrawals.unshift(withdrawal);
  state.withdrawalByKey.set(key, withdrawal.id);
  return ok({ withdrawal: wireWithdrawal(withdrawal, now) });
}

function handlePurchase(body: unknown, now: number): Answer {
  const key = keyOf(body);
  if (!key) return err(400, "idempotencyKey of at least 8 characters is required.");

  const existing = state.purchaseByKey.get(key);
  if (existing) {
    const p = state.purchases.find((row) => row.id === existing);
    if (p) return ok(wireTransaction(p, now));
  }

  const node = rec(body);
  const amount = minorOf(rec(node.amount).amountMinor);
  const serviceType = strOf(node.serviceType);
  const serviceCategory = strOf(node.serviceCategory);
  const serviceProviderId = strOf(node.serviceProviderId);
  const destinationIdentifier = strOf(node.destinationIdentifier);

  if (amount === null || amount <= 0n) {
    return err(400, "amount.amountMinor must be a positive integer minor-unit string.");
  }
  if (!serviceType || !serviceCategory || !serviceProviderId || !destinationIdentifier) {
    return err(400, "serviceType, serviceCategory, serviceProviderId and destinationIdentifier are required.");
  }
  if (!state.account || accountStatus(now) !== "ACTIVE") {
    return err(409, "No active linkpay account. (fixture)");
  }
  if (amount > state.balanceMinor) {
    return err(400, "Insufficient balance. (fixture)");
  }

  state.balanceMinor -= amount;
  const purchase: FixturePurchase = {
    id: nextId("vas"),
    createdAtMs: now,
    amountMinor: amount,
    serviceType,
    serviceCategory,
    serviceProviderId,
    serviceProviderName: PROVIDER_NAMES[serviceProviderId] ?? "Fixture Provider",
    serviceProductCode: strOf(node.serviceProductCode),
    destinationIdentifier,
    narration: strOf(node.narration),
    reference: nextId("vas-ref").toUpperCase(),
    withToken: serviceProviderId === "fixture-electric",
  };
  state.purchases.push(purchase);
  state.purchaseByKey.set(key, purchase.id);
  return ok(wireTransaction(purchase, now));
}

/* -------------------------------------------------------------------- router */

function route(method: string, path: string, query: Query, body: unknown): Answer {
  const now = Date.now();
  settleClock(now);

  const sub = path.slice("/v1/linkpay".length);
  const verb = `${method} ${sub}`;

  switch (verb) {
    case "GET /account": {
      if (!state.account) {
        // The contract's real answer for "entitled, never provisioned" — the
        // probe reads this as entitled with no account, which is the truth.
        return err(404, "No linkpay account provisioned. (fixture)");
      }
      return ok({ account: wireAccount(now) });
    }

    case "POST /accounts":
      return handleProvision(body, now);

    case "GET /balance":
      return ok({
        balance: {
          currency: CURRENCY,
          available: money(state.balanceMinor),
          ledger: money(state.balanceMinor),
        },
      });

    case "GET /deposits":
      return pageOf(state.deposits.map(wireDeposit), query);

    case "GET /banks":
      return pageOf(
        BANKS.filter(
          (bank) =>
            (!strOf(query.country) || bank.country === String(query.country).toUpperCase()) &&
            (!strOf(query.currency) || bank.currency === String(query.currency).toUpperCase()),
        ),
        {},
      );

    case "POST /banks/validate": {
      const node = rec(body);
      const bank = BANKS.find((b) => b.uuid === strOf(node.bankUuid));
      if (!bank) return err(404, "Unknown bank. (fixture)");
      if (!strOf(node.accountNumber)) return err(400, "accountNumber is required.");
      return ok({
        account: { accountName: FIXTURE_RECIPIENT, bankName: bank.name, bankCode: bank.code },
      });
    }

    case "POST /withdrawals/quote":
      return handleQuote(body);

    case "POST /withdrawals":
      return handleWithdraw(body, now);

    case "GET /withdrawals": {
      const status = strOf(query.status)?.toUpperCase();
      const rows = state.withdrawals
        .filter((w) => !status || withdrawalStatus(w, now) === status)
        .map((w) => wireWithdrawal(w, now));
      return pageOf(rows, query);
    }

    case "GET /services/providers": {
      const pair = `${strOf(query.serviceType)?.toLowerCase() ?? ""}|${
        strOf(query.category)?.toLowerCase() ?? ""
      }`;
      // Unknown pairs answer an empty list, so the catalogue sweep simply
      // never grows that shelf — the same shape the live gateway produces.
      return ok(PROVIDERS[pair] ?? []);
    }

    case "GET /services/products":
      return ok(PRODUCTS[strOf(query.serviceProviderId) ?? ""] ?? []);

    case "POST /services/purchases":
      return handlePurchase(body, now);

    default:
      break;
  }

  const depositId = matchId(sub, "/deposits/");
  if (method === "GET" && depositId) {
    const deposit = state.deposits.find((d) => d.id === depositId);
    return deposit
      ? ok({ deposit: wireDeposit(deposit) })
      : err(404, "Deposit not found. (fixture)");
  }

  const withdrawalId = matchId(sub, "/withdrawals/");
  if (method === "GET" && withdrawalId) {
    const withdrawal = state.withdrawals.find((w) => w.id === withdrawalId);
    return withdrawal
      ? ok({ withdrawal: wireWithdrawal(withdrawal, now) })
      : err(404, "Withdrawal not found. (fixture)");
  }

  const transactionId = matchId(sub, "/services/transactions/");
  if (method === "GET" && transactionId) {
    const purchase = state.purchases.find((p) => p.id === transactionId);
    return purchase
      ? ok(wireTransaction(purchase, now))
      : err(404, "Transaction not found. (fixture)");
  }

  // Never fall through to the network: a real call would 403 on the dead
  // entitlement and read as a broken screen instead of a missing handler.
  return err(404, `Fixture has no handler for ${method} ${path}.`);
}

function matchId(sub: string, prefix: string): string | null {
  if (!sub.startsWith(prefix)) return null;
  const id = decodeURIComponent(sub.slice(prefix.length));
  return id !== "" && !id.includes("/") ? id : null;
}

/* ----------------------------------------------------------------- the seam */

/**
 * The one function `client.ts` calls. Returns `null` when the flag is off or
 * the path is not a linkpay route — in either case the request proceeds to the
 * real network untouched. Otherwise returns a promise that resolves with the
 * fixture body after simulated latency, or rejects with a gateway-shaped
 * `ApiError`, tracing either way with a FIXTURE marker.
 */
export function maybeAnswerLinkpayFixture<T>(
  method: string,
  path: string,
  query: Query | undefined,
  body: unknown,
  correlationId: string,
  trace: Trace,
): Promise<T> | null {
  if (!linkpayFixtures) return null;
  if (!path.startsWith("/v1/linkpay/")) return null;

  return (async () => {
    await sleep(LATENCY_MIN_MS + Math.random() * LATENCY_JITTER_MS);
    const answer = route(method, path, query ?? {}, body);

    trace("FIXTURE response", {
      fixture: "FIXTURE",
      method,
      path,
      status: answer.status,
      correlationId,
    });

    if (answer.status >= 400) {
      throw new ApiError({
        statusCode: answer.status,
        message: answer.message ?? `Fixture request failed (${answer.status}).`,
        correlationId,
      });
    }
    return answer.body as T;
  })();
}
