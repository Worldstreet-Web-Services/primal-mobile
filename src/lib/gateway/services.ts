/**
 * Value-added services — airtime, data, electricity, TV and the rest of the
 * bill catalogue — on top of the one gateway client.
 *
 * Four routes, all entitled (ACTIVE subscription) and all bearer-authenticated:
 *
 *   GET  /v1/linkpay/services/providers?serviceType&category&country
 *   GET  /v1/linkpay/services/products?serviceProviderId&country
 *   POST /v1/linkpay/services/purchases
 *   GET  /v1/linkpay/services/transactions/{id}
 *
 * Three things shape everything below.
 *
 * 1. **The catalogue is discovered, not declared.** `providers` takes
 *    `serviceType` AND `category` as REQUIRED query params, and the gateway
 *    publishes no route that lists either. So there is no honest way to render
 *    "what can I pay for?" except to ask for a set of candidate pairs and keep
 *    the ones that answer with providers. `discoverCatalog` does exactly that;
 *    a category the API does not serve never reaches the UI.
 *
 * 2. **The response bodies are undocumented.** The live OpenAPI (v0.1.0)
 *    describes every 200 here as an empty schema, and the upstream this wraps
 *    speaks snake_case (`product_code`, `service_provider_id`). Every reader in
 *    this file therefore accepts both dialects and treats a missing field as
 *    `null` — never as a crash, and never as a zero.
 *
 * 3. **A service token is a bearer instrument.** An electricity token IS the
 *    electricity. It is normalised into `serviceToken`, handed to the UI, and
 *    never logged, never persisted, never put in a correlation breadcrumb. The
 *    only `console` call in this module is the sweep trace, and it carries
 *    counts, not bodies.
 */

import { get, post } from "./client";
import { normalizeCurrency, parseMinor, toBigInt } from "./money";
import {
  AbortedError,
  ApiError,
  asTransferStatus,
  isEntitlementError,
  isTerminalTransfer,
  NetworkError,
  SessionExpiredError,
  type Money,
  type ServiceProduct,
  type ServiceProvider,
  type ServiceTransaction,
  type TransferStatus,
  type WireTimestamp,
} from "./types";

/* ------------------------------------------------------------ wire reading */

type Raw = Record<string, unknown>;

const asRaw = (value: unknown): Raw =>
  value !== null && typeof value === "object" ? (value as Raw) : {};

/** First field present under any of `names`, camelCase or snake_case. */
function pick(source: Raw, ...names: string[]): unknown {
  for (const name of names) {
    const value = source[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function str(source: Raw, ...names: string[]): string | null {
  const value = pick(source, ...names);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function bool(source: Raw, ...names: string[]): boolean | null {
  const value = pick(source, ...names);
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * A list, however the gateway chose to wrap it.
 *
 * `readPage` in types.ts covers the paginated shapes; these catalogue routes
 * are unpaginated and have been seen (upstream) as a bare array, so this
 * accepts the bare form plus the usual envelopes without inventing page
 * numbers that do not exist.
 */
function readList(raw: unknown): Raw[] {
  if (Array.isArray(raw)) return raw.map(asRaw);
  const outer = asRaw(raw);
  for (const key of ["data", "items", "results", "records", "providers", "products"]) {
    const value = outer[key];
    if (Array.isArray(value)) return value.map(asRaw);
    // One more level: { data: { items: [...] } } is a real envelope shape.
    if (value !== null && typeof value === "object") {
      const inner = asRaw(value);
      for (const innerKey of ["items", "data", "results", "records"]) {
        const innerValue = inner[innerKey];
        if (Array.isArray(innerValue)) return innerValue.map(asRaw);
      }
    }
  }
  return [];
}

/**
 * Money, from whatever the provider feed happens to carry.
 *
 * - `{ amountMinor, currency }` — the gateway's own `MoneyDto`.
 * - An integer (number or digit string) — minor units, per the contract. The
 *   upstream quotes bundle prices as kobo integers.
 * - A decimal string — major units, converted by string surgery in
 *   `parseMinor`. No float touches an amount at any point on this path.
 *
 * Anything else is `null`. A price we cannot read has to render as "—", not as
 * a confident wrong number.
 */
function readMoney(value: unknown, fallbackCurrency: string): Money | null {
  const currency = normalizeCurrency(fallbackCurrency);

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
    return { amountMinor: BigInt(value).toString(), currency };
  }

  if (typeof value === "string") {
    const raw = value.trim().replace(/[\s,_]/g, "");
    if (raw === "") return null;
    if (/^-?\d+$/.test(raw)) return { amountMinor: raw, currency };
    if (/^-?\d*\.\d+$/.test(raw)) {
      try {
        return { amountMinor: parseMinor(raw, currency, { precision: "truncate" }), currency };
      } catch {
        return null;
      }
    }
    return null;
  }

  if (value !== null && typeof value === "object") {
    const node = asRaw(value);
    const nodeCurrency = str(node, "currency", "currencyCode", "currency_code") ?? currency;
    const minor = pick(
      node,
      "amountMinor",
      "amount_minor",
      "minorAmount",
      "minor_amount",
      "amount",
      "value",
    );
    if (minor === undefined) return null;
    return readMoney(minor, nodeCurrency);
  }

  return null;
}

/** Positive, readable, integer minor units — the only amount worth sending. */
export function isPayableAmount(amount: Money | null | undefined): boolean {
  if (!amount) return false;
  try {
    return toBigInt(amount.amountMinor) > 0n;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- entities */

/**
 * A biller or telco. Normalised from the provider feed.
 *
 * `id` is the field that goes back as `serviceProviderId` on a purchase. The
 * upstream also carries a separate `provider_id` UUID which is NOT accepted
 * there, so it is kept apart under `providerUuid` and only ever used as a last
 * resort when a row has no `id` at all.
 */
export interface VasProvider extends ServiceProvider {
  shortName: string | null;
  /** The upstream's own UUID. Never send this as `serviceProviderId`. */
  providerUuid: string | null;
  /**
   * `false` when the biller exposes no customer lookup, so a meter or smartcard
   * number can never be confirmed before paying. Surfaced, not enforced.
   */
  requiresValidation: boolean | null;
}

/**
 * A bundle, denomination or plan under one provider. `amount` is inherited
 * from `ServiceProduct` and stays optional: a feed that omits a price is a
 * product the user has to name an amount for, not a free one.
 */
export interface VasProduct extends ServiceProduct {
  code: string;
  name: string;
  /** "1.5GB", "30 days" — free text from the feed, shown as-is when present. */
  dataSize: string | null;
  validity: string | null;
  /** True when the product's own price is the price; false lets the user type. */
  fixedAmount: boolean;
}

/**
 * A purchase, read back from the gateway.
 *
 * This is the normalised projection of the foundation's `ServiceTransaction`:
 * same route, every field explicitly nullable, and the token renamed to
 * `serviceToken` so nothing can print it by accident while spreading a
 * transaction into a log line.
 */
export interface VasTransaction {
  /** Null only when the gateway accepted a purchase without naming it. */
  id: string | null;
  status: TransferStatus;
  amount: Money | null;
  fee: Money | null;
  /** What actually leaves the balance. Falls back to `amount` when unfeed. */
  totalDebit: Money | null;
  serviceType: string | null;
  serviceCategory: string | null;
  serviceProviderId: string | null;
  serviceProviderName: string | null;
  serviceProductCode: string | null;
  destinationIdentifier: string | null;
  /** Resolved customer name, when the biller supports a lookup. */
  customerName: string | null;
  narration: string | null;
  reference: string | null;
  /**
   * SENSITIVE. The electricity/voucher token the user must keep. Display it,
   * let them copy it, and let it die with the screen — never log or persist it.
   */
  serviceToken: string | null;
  /** "23.4 kWh" and similar, when the provider states units alongside a token. */
  tokenUnits: string | null;
  failureReason: string | null;
  createdAt: WireTimestamp;
  updatedAt: WireTimestamp;
}

function readProvider(row: Raw, fallback: { serviceType: string; category: string; country: string }): VasProvider | null {
  const id =
    str(row, "id", "serviceProviderId", "service_provider_id", "providerId") ??
    str(row, "provider_id", "uuid", "code");
  const name = str(row, "name", "providerName", "provider_name", "shortName", "short_name");
  if (!id || !name) return null;

  return {
    id,
    name,
    shortName: str(row, "shortName", "short_name"),
    providerUuid: str(row, "provider_id", "providerUuid", "provider_uuid"),
    serviceType: str(row, "serviceType", "service_type") ?? fallback.serviceType,
    category: str(row, "category", "serviceCategory", "service_category") ?? fallback.category,
    country: str(row, "country", "countryCode", "country_code") ?? fallback.country,
    logoUrl: str(row, "logoUrl", "logo_url", "logo", "imageUrl", "image_url") ?? undefined,
    requiresValidation: bool(row, "requiresValidation", "requires_validation"),
  };
}

function readProduct(row: Raw, currency: string): VasProduct | null {
  const code = str(
    row,
    "code",
    "productCode",
    "product_code",
    "serviceProductCode",
    "service_product_code",
    "id",
  );
  const name =
    str(row, "name", "productName", "product_name", "description", "label") ??
    str(row, "dataSize", "data_size");
  if (!code || !name) return null;

  const amount = readMoney(
    pick(row, "amount", "price", "amountMinor", "amount_minor", "cost"),
    currency,
  );
  const explicitlyFixed = bool(row, "fixedAmount", "fixed_amount", "isAmountFixed", "is_amount_fixed");

  return {
    code,
    name,
    serviceProviderId:
      str(row, "serviceProviderId", "service_provider_id", "providerId", "provider_id") ??
      undefined,
    amount: amount ?? undefined,
    dataSize: str(row, "dataSize", "data_size", "size"),
    validity: str(row, "validity", "duration", "period", "expiry"),
    fixedAmount: explicitlyFixed ?? isPayableAmount(amount),
  };
}

/**
 * Pull the token out of wherever the provider hid it.
 *
 * Seen in the wild at the top level, under `metadata`, and prefixed with a
 * literal "token: " that has to come off before anyone tries to type it into a
 * meter. Nothing here is logged.
 */
function readToken(row: Raw): string | null {
  const TOKEN_FIELDS = [
    "serviceToken",
    "service_token",
    "token",
    "deliveryToken",
    "delivery_token",
    "voucherCode",
    "voucher_code",
    "voucher",
    "pin",
  ];

  const scopes: Raw[] = [row];
  for (const key of ["metadata", "meta", "extra", "details", "delivery", "result", "data"]) {
    const nested = row[key];
    if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
      scopes.push(asRaw(nested));
    }
  }

  for (const scope of scopes) {
    const value = str(scope, ...TOKEN_FIELDS);
    if (!value) continue;
    const cleaned = value.replace(/^token\s*[:\-]?\s*/i, "").trim();
    if (cleaned !== "") return cleaned;
  }
  return null;
}

function readTransaction(raw: unknown, fallbackCurrency: string): VasTransaction {
  const outer = asRaw(raw);
  // The create response has been seen both bare and wrapped in `transaction`.
  const inner = pick(outer, "transaction", "serviceTransaction", "service_transaction", "data");
  const row = inner !== undefined && typeof inner === "object" ? asRaw(inner) : outer;

  const currency =
    str(row, "currency", "currencyCode", "currency_code") ?? normalizeCurrency(fallbackCurrency);
  const amount = readMoney(pick(row, "amount", "amountMinor", "amount_minor"), currency);
  const fee = readMoney(pick(row, "fee", "feeMinor", "fee_minor", "charge"), currency);
  const total = readMoney(
    pick(row, "totalDebit", "total_debit", "total", "debit", "totalAmount", "total_amount"),
    currency,
  );

  return {
    id: str(row, "id", "transactionId", "transaction_id", "reference", "ref"),
    status: asTransferStatus(pick(row, "status", "state", "transactionStatus", "transaction_status")),
    amount,
    fee,
    totalDebit: total ?? amount,
    serviceType: str(row, "serviceType", "service_type"),
    serviceCategory: str(row, "serviceCategory", "service_category", "category"),
    serviceProviderId: str(row, "serviceProviderId", "service_provider_id"),
    serviceProviderName: str(row, "serviceProviderName", "service_provider_name", "providerName"),
    serviceProductCode: str(row, "serviceProductCode", "service_product_code", "productCode"),
    destinationIdentifier: str(
      row,
      "destinationIdentifier",
      "destination_identifier",
      "destination",
      "customerReference",
      "customer_reference",
    ),
    customerName: str(row, "customerName", "customer_name", "accountName", "account_name"),
    narration: str(row, "narration", "description"),
    reference: str(row, "reference", "ref", "providerReference", "provider_reference"),
    serviceToken: readToken(row),
    tokenUnits: str(row, "units", "tokenUnits", "token_units", "unitsPurchased"),
    failureReason: str(row, "failureReason", "failure_reason", "reason", "message", "error"),
    createdAt: (pick(row, "createdAt", "created_at") ?? null) as WireTimestamp,
    updatedAt: (pick(row, "updatedAt", "updated_at", "settledAt", "settled_at") ?? null) as WireTimestamp,
  };
}

/* ------------------------------------------------------------ destinations */

/** What the user has to type, and therefore how the field behaves. */
export type DestinationKind = "phone" | "meter" | "smartcard" | "account";

export interface DestinationSpec {
  kind: DestinationKind;
  label: string;
  placeholder: string;
  /** Digits only for every kind we ship; kept explicit for the odd biller. */
  numeric: boolean;
  minLength: number;
  maxLength: number;
  help: string;
}

const DESTINATIONS: Record<DestinationKind, DestinationSpec> = {
  phone: {
    kind: "phone",
    label: "Phone number",
    placeholder: "0803 000 0000",
    numeric: true,
    minLength: 10,
    maxLength: 14,
    help: "The line being topped up.",
  },
  meter: {
    kind: "meter",
    label: "Meter number",
    placeholder: "01234567890",
    numeric: true,
    minLength: 6,
    maxLength: 20,
    help: "Printed on the meter and on your last token receipt.",
  },
  smartcard: {
    kind: "smartcard",
    label: "Smartcard / IUC number",
    placeholder: "1234567890",
    numeric: true,
    minLength: 8,
    maxLength: 16,
    help: "On the decoder, or under Settings on screen.",
  },
  account: {
    kind: "account",
    label: "Customer reference",
    placeholder: "Account or customer number",
    numeric: false,
    minLength: 3,
    maxLength: 32,
    help: "Whatever the biller prints on your statement.",
  },
};

export const destinationSpec = (kind: DestinationKind): DestinationSpec => DESTINATIONS[kind];

/** Strip the formatting people type. Never mutates meaning, only spacing. */
export function normalizeDestination(kind: DestinationKind, raw: string): string {
  const trimmed = raw.trim();
  if (kind === "account") return trimmed.replace(/\s+/g, " ");
  return trimmed.replace(/[\s\-()]/g, "");
}

/**
 * Nigerian numbers go to the provider in international form without the plus —
 * `08031234567` becomes `2348031234567`, which is what the upstream expects.
 * Everything else is sent exactly as typed, minus separators.
 */
export function wireDestination(kind: DestinationKind, raw: string, country = "NG"): string {
  const cleaned = normalizeDestination(kind, raw);
  if (kind !== "phone" || normalizeCurrency(country) !== "NG") return cleaned;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

/** `null` when it passes. The string is what the field shows underneath. */
export function validateDestination(
  kind: DestinationKind,
  raw: string,
  country = "NG",
): string | null {
  const value = normalizeDestination(kind, raw);
  if (value === "") return null; // Empty is "not yet", not "wrong".

  const spec = DESTINATIONS[kind];
  if (spec.numeric && !/^[0-9+]+$/.test(value)) return "Digits only.";

  if (kind === "phone" && normalizeCurrency(country) === "NG") {
    const local = value.replace(/\D/g, "").replace(/^234/, "0");
    if (!/^0\d{10}$/.test(local)) return "A Nigerian number is 11 digits, starting 0.";
    return null;
  }

  if (value.length < spec.minLength) return `That looks short for a ${spec.label.toLowerCase()}.`;
  if (value.length > spec.maxLength) return `That looks long for a ${spec.label.toLowerCase()}.`;
  return null;
}

/**
 * Phone prefix → network, from the NCC allocations.
 *
 * Two things this table is NOT. It is not complete: an unknown prefix returns
 * `null` and the UI must stay quiet rather than guess. And it is not
 * authoritative: Nigeria has number portability, so a 0803 line can genuinely
 * sit on Glo. It exists to WARN when the picked network disagrees with the
 * number — airtime sent to the wrong network is gone — and never to override a
 * deliberate choice.
 */
const NG_PREFIXES: Readonly<Record<string, string>> = {
  "0803": "MTN", "0806": "MTN", "0813": "MTN", "0816": "MTN", "0703": "MTN",
  "0706": "MTN", "0810": "MTN", "0814": "MTN", "0903": "MTN", "0906": "MTN",
  "0913": "MTN", "0916": "MTN", "0704": "MTN",
  "0802": "Airtel", "0808": "Airtel", "0812": "Airtel", "0708": "Airtel",
  "0701": "Airtel", "0902": "Airtel", "0907": "Airtel", "0901": "Airtel",
  "0904": "Airtel", "0912": "Airtel",
  "0805": "Glo", "0807": "Glo", "0815": "Glo", "0705": "Glo", "0905": "Glo",
  "0915": "Glo", "0811": "Glo",
  "0809": "9mobile", "0817": "9mobile", "0818": "9mobile", "0908": "9mobile",
  "0909": "9mobile", "0918": "9mobile",
};

/** The network a Nigerian number was issued on, or `null` if unlisted. */
export function detectNetwork(phone: string, country = "NG"): string | null {
  if (normalizeCurrency(country) !== "NG") return null;
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("234") ? `0${digits.slice(3)}` : digits;
  if (local.length < 4) return null;
  return NG_PREFIXES[local.slice(0, 4)] ?? null;
}

/**
 * True when the provider the user picked and the number they typed disagree.
 * Compared on first word, case-insensitively — feeds spell it "MTN Nigeria",
 * "MTN NG" and "Mtn".
 */
export function networkMismatch(providerName: string, phone: string, country = "NG"): string | null {
  const detected = detectNetwork(phone, country);
  if (!detected) return null;
  const head = providerName.trim().split(/[\s\-_]/)[0]?.toLowerCase() ?? "";
  const target = detected.toLowerCase();
  if (head === "" || head === target || target.startsWith(head) || head.startsWith(target)) {
    return null;
  }
  return detected;
}

/* -------------------------------------------------------------- catalogue */

/**
 * A candidate slice of the catalogue.
 *
 * `categories` is a list of spellings, not a list of categories: the same
 * shelf under every name the upstream has been seen to use for it. The first
 * one that answers with providers wins and becomes the pair sent on every
 * later call, so the purchase always carries the taxonomy the discovery
 * actually proved.
 */
interface CategoryCandidate {
  key: string;
  label: string;
  blurb: string;
  serviceType: string;
  categories: string[];
  destination: DestinationKind;
  /** Airtime takes any amount; a data bundle does not. */
  freeAmount: boolean;
}

/**
 * Ordered by how often people reach for them. The service types come from the
 * upstream taxonomy (`airtime` | `data` | `bill_payment`) and the category
 * spellings from its biller tags; anything the gateway does not serve simply
 * never appears.
 */
const CANDIDATES: readonly CategoryCandidate[] = [
  {
    key: "airtime",
    label: "Airtime",
    blurb: "Top up any line",
    serviceType: "airtime",
    categories: ["airtime", "mobile", "telco"],
    destination: "phone",
    freeAmount: true,
  },
  {
    key: "data",
    label: "Data",
    blurb: "Bundles by network",
    serviceType: "data",
    categories: ["data", "mobile", "internet"],
    destination: "phone",
    freeAmount: false,
  },
  {
    key: "electricity",
    label: "Electricity",
    blurb: "Prepaid and postpaid meters",
    serviceType: "bill_payment",
    categories: ["electricity", "power", "utility"],
    destination: "meter",
    freeAmount: true,
  },
  {
    key: "cable_tv",
    label: "TV",
    blurb: "DStv, GOtv, StarTimes",
    serviceType: "bill_payment",
    categories: ["cable_tv", "cabletv", "tv"],
    destination: "smartcard",
    freeAmount: false,
  },
  {
    key: "internet",
    label: "Internet",
    blurb: "Home and office plans",
    serviceType: "bill_payment",
    categories: ["internet", "isp", "broadband"],
    destination: "account",
    freeAmount: false,
  },
  {
    key: "water",
    label: "Water",
    blurb: "Utility boards",
    serviceType: "bill_payment",
    categories: ["water"],
    destination: "account",
    freeAmount: true,
  },
  {
    key: "education",
    label: "Education",
    blurb: "Exam pins and fees",
    serviceType: "bill_payment",
    categories: ["education"],
    destination: "account",
    freeAmount: false,
  },
  {
    key: "government",
    label: "Government",
    blurb: "Levies and revenue",
    serviceType: "bill_payment",
    categories: ["government"],
    destination: "account",
    freeAmount: true,
  },
  {
    key: "other",
    label: "Other bills",
    blurb: "Everything else on the biller list",
    serviceType: "bill_payment",
    categories: ["other"],
    destination: "account",
    freeAmount: true,
  },
];

/** A shelf the gateway actually serves, with the providers that proved it. */
export interface VasCategory {
  key: string;
  label: string;
  blurb: string;
  /** The exact pair that answered — send these back on the purchase. */
  serviceType: string;
  category: string;
  destination: DestinationKind;
  freeAmount: boolean;
  providers: VasProvider[];
}

interface CatalogCache {
  country: string;
  at: number;
  categories: VasCategory[];
}

/** Reference data changes on the order of days; ten minutes is plenty. */
const CATALOG_TTL_MS = 10 * 60 * 1000;
/** Politeness against a 120/min budget shared with the rest of the app. */
const SWEEP_CONCURRENCY = 3;

let catalogCache: CatalogCache | null = null;

/** Drop the discovered catalogue — call after a sign-out. */
export function clearCatalogCache(): void {
  catalogCache = null;
}

export interface ListProvidersOptions {
  serviceType: string;
  category: string;
  country?: string;
  signal?: AbortSignal;
}

export async function listProviders(options: ListProvidersOptions): Promise<VasProvider[]> {
  const country = options.country ?? "NG";
  const raw = await get<unknown>("/v1/linkpay/services/providers", {
    query: {
      serviceType: options.serviceType,
      category: options.category,
      country,
    },
    signal: options.signal,
  });

  const fallback = {
    serviceType: options.serviceType,
    category: options.category,
    country,
  };
  return readList(raw)
    .map((row) => readProvider(row, fallback))
    .filter((provider): provider is VasProvider => provider !== null);
}

export interface ListProductsOptions {
  serviceProviderId: string;
  country?: string;
  /** Used only to label prices the feed sends as bare integers. */
  currency?: string;
  signal?: AbortSignal;
}

export async function listProducts(options: ListProductsOptions): Promise<VasProduct[]> {
  const raw = await get<unknown>("/v1/linkpay/services/products", {
    query: {
      serviceProviderId: options.serviceProviderId,
      country: options.country ?? "NG",
    },
    signal: options.signal,
  });

  return readList(raw)
    .map((row) => readProduct(row, options.currency ?? "NGN"))
    .filter((product): product is VasProduct => product !== null);
}

/**
 * An error that must stop the sweep rather than being read as "this shelf is
 * empty": the session is gone, we are not entitled, or we are being throttled.
 */
function isFatalSweepError(error: unknown): boolean {
  if (SessionExpiredError.is(error) || AbortedError.is(error)) return true;
  if (isEntitlementError(error)) return true;
  if (ApiError.is(error)) {
    return error.statusCode === 401 || error.statusCode === 403 || error.statusCode === 429;
  }
  // A network failure mid-sweep would otherwise silently shrink the catalogue.
  return NetworkError.is(error);
}

async function probeCandidate(
  candidate: CategoryCandidate,
  spelling: (value: string) => string,
  country: string,
  signal?: AbortSignal,
): Promise<VasCategory | null> {
  for (const category of candidate.categories) {
    const serviceType = spelling(candidate.serviceType);
    const spelled = spelling(category);
    let providers: VasProvider[];
    try {
      providers = await listProviders({ serviceType, category: spelled, country, signal });
    } catch (error) {
      if (isFatalSweepError(error)) throw error;
      // 400 (unknown category), 404, 502 from the provider: this spelling is
      // not it. Try the next one rather than losing the whole shelf.
      continue;
    }
    if (providers.length === 0) continue;
    return {
      key: candidate.key,
      label: candidate.label,
      blurb: candidate.blurb,
      serviceType,
      category: spelled,
      destination: candidate.destination,
      freeAmount: candidate.freeAmount,
      providers,
    };
  }
  return null;
}

/** Fixed-size worker pool, so the sweep never fires nine requests at once. */
async function sweep(
  spelling: (value: string) => string,
  country: string,
  signal: AbortSignal | undefined,
  onCategory: ((category: VasCategory) => void) | undefined,
): Promise<VasCategory[]> {
  const found: VasCategory[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= CANDIDATES.length) return;
      const category = await probeCandidate(CANDIDATES[index], spelling, country, signal);
      if (category) {
        found.push(category);
        onCategory?.(category);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(SWEEP_CONCURRENCY, CANDIDATES.length) }, worker),
  );

  // Workers finish out of order; the shelf order is a product decision.
  const rank = new Map(CANDIDATES.map((c, i) => [c.key, i]));
  return found.sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
}

export interface DiscoverOptions {
  country?: string;
  signal?: AbortSignal;
  /** Fired as each shelf lands, so the grid fills in instead of blocking. */
  onCategory?: (category: VasCategory) => void;
  /** Skip the cache — a pull-to-refresh. */
  force?: boolean;
}

/**
 * Ask the gateway which shelves exist.
 *
 * The sweep runs in the upstream's own lowercase taxonomy first. Only if that
 * comes back completely empty — no shelf, no error — does it try again in
 * upper case, on the theory that a gateway which normalises enums would
 * normalise them all the same way. Two sweeps is the ceiling; the result is
 * cached per country so re-entering the screen costs nothing.
 *
 * Throws `SessionExpiredError` (sign in), an entitlement `ApiError` (403 →
 * subscription), or `NetworkError`. Never throws for an empty catalogue: an
 * empty array means the account genuinely has no services, which the UI has to
 * be able to say out loud.
 */
export async function discoverCatalog(options: DiscoverOptions = {}): Promise<VasCategory[]> {
  const country = options.country ?? "NG";

  if (!options.force && catalogCache && catalogCache.country === country) {
    if (Date.now() - catalogCache.at < CATALOG_TTL_MS) {
      for (const category of catalogCache.categories) options.onCategory?.(category);
      return catalogCache.categories;
    }
  }

  let categories = await sweep(
    (value) => value.toLowerCase(),
    country,
    options.signal,
    options.onCategory,
  );

  if (categories.length === 0) {
    categories = await sweep(
      (value) => value.toUpperCase(),
      country,
      options.signal,
      options.onCategory,
    );
  }

  catalogCache = { country, at: Date.now(), categories };
  return categories;
}

/* --------------------------------------------------------------- purchase */

export interface PurchaseIntent {
  serviceType: string;
  serviceCategory: string;
  serviceProviderId: string;
  /** Already in wire form — run it through `wireDestination` first. */
  destinationIdentifier: string;
  amount: Money;
  serviceProductCode?: string | null;
  narration?: string | null;
}

export class PurchaseInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseInputError";
  }
}

/**
 * Buy the thing.
 *
 * `idempotencyKey` is the caller's, deliberately: it must be minted ONCE for an
 * intended purchase, persisted beside it, and reused for every retry of that
 * same purchase with the same parameters. A timeout is not a failure. Minting a
 * second key after one is how a user buys two bundles and notices next month.
 *
 * The client replays this POST on a network failure precisely because the key
 * is in the body — which is also why this function must never mint one itself.
 */
export async function purchase(
  intent: PurchaseIntent,
  options: { idempotencyKey: string; signal?: AbortSignal },
): Promise<VasTransaction> {
  const key = options.idempotencyKey;
  if (typeof key !== "string" || key.length < 8 || key.length > 128) {
    throw new PurchaseInputError("An idempotency key of 8–128 characters is required.");
  }
  if (!isPayableAmount(intent.amount)) {
    throw new PurchaseInputError("Amount must be a positive integer in minor units.");
  }
  if (!intent.serviceProviderId || !intent.destinationIdentifier) {
    throw new PurchaseInputError("Provider and destination are both required.");
  }

  const body = {
    idempotencyKey: key,
    serviceType: intent.serviceType,
    serviceCategory: intent.serviceCategory,
    serviceProviderId: intent.serviceProviderId,
    destinationIdentifier: intent.destinationIdentifier,
    amount: {
      amountMinor: intent.amount.amountMinor,
      currency: normalizeCurrency(intent.amount.currency),
    },
    ...(intent.serviceProductCode ? { serviceProductCode: intent.serviceProductCode } : {}),
    ...(intent.narration ? { narration: intent.narration } : {}),
  };

  const raw = await post<unknown>("/v1/linkpay/services/purchases", body, {
    signal: options.signal,
  });
  return readTransaction(raw, intent.amount.currency);
}

export async function getTransaction(
  id: string,
  options: { currency?: string; signal?: AbortSignal } = {},
): Promise<VasTransaction> {
  const raw = await get<unknown>(
    `/v1/linkpay/services/transactions/${encodeURIComponent(id)}`,
    { signal: options.signal },
  );
  return readTransaction(raw, options.currency ?? "NGN");
}

/* ----------------------------------------------------------------- polling */

export interface PollOptions {
  currency?: string;
  signal?: AbortSignal;
  /** Called with every snapshot, including the terminal one. */
  onUpdate?: (transaction: VasTransaction) => void;
  /** First gap after the purchase. Grows towards `maxIntervalMs`. */
  intervalMs?: number;
  maxIntervalMs?: number;
  /** Give up narrating after this and let the UI say "still working". */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Follow a purchase from REQUESTED to a terminal state.
 *
 * Resolves with the last snapshot it saw — terminal if it got one, otherwise
 * whatever it had when the deadline passed. It does NOT throw on a slow
 * provider: "we are still watching" is a real outcome and the screen says so.
 *
 * It does throw `SessionExpiredError` and `AbortedError`, which are not about
 * this transaction, and it gives up after a run of network failures rather than
 * polling a dead connection forever.
 */
export async function pollTransaction(
  id: string,
  options: PollOptions = {},
): Promise<VasTransaction> {
  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 150_000;
  const maxIntervalMs = options.maxIntervalMs ?? 8_000;
  let delay = options.intervalMs ?? 2_500;

  let last: VasTransaction = {
    id,
    status: "REQUESTED",
    amount: null,
    fee: null,
    totalDebit: null,
    serviceType: null,
    serviceCategory: null,
    serviceProviderId: null,
    serviceProviderName: null,
    serviceProductCode: null,
    destinationIdentifier: null,
    customerName: null,
    narration: null,
    reference: null,
    serviceToken: null,
    tokenUnits: null,
    failureReason: null,
    createdAt: null,
    updatedAt: null,
  };

  let consecutiveNetworkFailures = 0;
  let notFound = 0;

  for (;;) {
    if (options.signal?.aborted) throw new AbortedError();

    try {
      const snapshot = await getTransaction(id, {
        currency: options.currency,
        signal: options.signal,
      });
      consecutiveNetworkFailures = 0;
      last = snapshot;
      options.onUpdate?.(snapshot);
      if (isTerminalTransfer(snapshot.status)) return snapshot;
    } catch (error) {
      if (SessionExpiredError.is(error) || AbortedError.is(error)) throw error;

      if (NetworkError.is(error)) {
        consecutiveNetworkFailures += 1;
        // Five misses is a connection problem, not a slow provider.
        if (consecutiveNetworkFailures >= 5) throw error;
      } else if (ApiError.is(error) && error.statusCode === 404) {
        // The write may not have propagated to the read side yet.
        notFound += 1;
        if (notFound >= 3) throw error;
      } else if (ApiError.is(error) && error.statusCode === 429) {
        delay = Math.max(delay, error.retryAfterMs ?? maxIntervalMs);
      } else if (ApiError.is(error) && error.statusCode >= 500) {
        // Provider wobble. Keep watching — the purchase is already placed.
        delay = Math.min(delay * 2, maxIntervalMs);
      } else {
        throw error;
      }
    }

    if (Date.now() - started >= timeoutMs) return last;
    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.35), maxIntervalMs);
  }
}

/* -------------------------------------------------------------- narration */

/** One line of plain English per state, for the tracking card. */
export function describeStatus(status: TransferStatus): { title: string; detail: string } {
  switch (status) {
    case "REQUESTED":
      return { title: "Placed", detail: "Sent to the provider." };
    case "SUBMITTED":
      return { title: "With the provider", detail: "Waiting for them to accept it." };
    case "PROCESSING":
      return { title: "Delivering", detail: "The provider is fulfilling it now." };
    case "SETTLED":
    case "DELIVERED":
      return { title: "Delivered", detail: "The provider confirmed it." };
    case "FAILED":
      return { title: "Not delivered", detail: "The provider could not fulfil it." };
    case "REVERSED":
      return { title: "Reversed", detail: "The debit was returned to your balance." };
    default:
      // A status this build has never heard of. Say so rather than guessing at
      // success and letting someone walk away from a bill they still owe.
      return { title: "In progress", detail: "Awaiting a status we recognise." };
  }
}

export const isDelivered = (status: TransferStatus): boolean =>
  status === "DELIVERED" || status === "SETTLED";

export const isFailure = (status: TransferStatus): boolean =>
  status === "FAILED" || status === "REVERSED";
