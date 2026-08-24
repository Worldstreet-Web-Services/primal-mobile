/**
 * Minor-unit money. Pure, dependency-free, unit-testable.
 *
 * Every amount on the Primal gateway is an integer count of a currency's
 * smallest unit, carried as a string: NGN `"10000"` is ₦100.00, USDC
 * `"1000000000"` is 1,000.000000. Nothing in this file converts through
 * `Number` — `0.1 + 0.2` is the reason, and at ₦ scale the error stops being
 * academic. Arithmetic is BigInt; presentation is string surgery.
 *
 * The decimal exponent comes from a table, never from a guess. A currency that
 * isn't in the table has no defined exponent here, and every entry point says
 * so rather than defaulting to 2 and being quietly wrong about USDC.
 */

import type { Money } from "./types";

/**
 * Minor-unit exponents. Fiat entries are ISO 4217; the stablecoins are their
 * on-chain `decimals()`, which is what settlement amounts are quoted in.
 *
 * USDC is 6, not 2. `requiredSettlementAmount: "1000000000"` is 1,000 USDC —
 * reading it as 2dp would show the user a ten-million-dollar invoice.
 */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  // Fiat, 2dp
  NGN: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  GHS: 2,
  KES: 2,
  ZAR: 2,
  CAD: 2,
  AUD: 2,
  // Fiat with no minor unit at all — the reason a blanket `2` is unsafe.
  JPY: 0,
  KRW: 0,
  // Stablecoins, at their token decimals
  USDC: 6,
  USDT: 6,
  DAI: 18,
  // Native assets that show up in origin-chain quotes
  ETH: 18,
  SOL: 9,
  TRX: 6,
};

/** Symbols worth printing. Anything else falls back to the code. */
const SYMBOLS: Readonly<Record<string, string>> = {
  NGN: "₦",
  USD: "$",
  EUR: "€",
  GBP: "£",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
  JPY: "¥",
};

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export const normalizeCurrency = (currency: string): string =>
  currency.trim().toUpperCase();

export function isKnownCurrency(currency: string): boolean {
  return normalizeCurrency(currency) in CURRENCY_DECIMALS;
}

/** The exponent, or `null` when the currency isn't in the table. */
export function decimalsFor(currency: string): number | null {
  return CURRENCY_DECIMALS[normalizeCurrency(currency)] ?? null;
}

function requireDecimals(currency: string): number {
  const d = decimalsFor(currency);
  if (d === null) {
    throw new MoneyError(
      `Unknown currency "${currency}" — add its minor-unit exponent to CURRENCY_DECIMALS before handling money in it.`,
    );
  }
  return d;
}

/* --------------------------------------------------------------- primitives */

const MINOR_PATTERN = /^-?\d+$/;

/** Parse a minor-unit string to BigInt, refusing anything that isn't one. */
export function toBigInt(amountMinor: string): bigint {
  const raw = amountMinor.trim();
  if (!MINOR_PATTERN.test(raw)) {
    throw new MoneyError(
      `"${amountMinor}" is not an integer minor-unit amount. Money never arrives as a decimal or a float.`,
    );
  }
  return BigInt(raw);
}

export const money = (
  amountMinor: string | bigint,
  currency: string,
): Money => ({
  amountMinor:
    typeof amountMinor === "bigint" ? amountMinor.toString() : amountMinor,
  currency: normalizeCurrency(currency),
});

export const zero = (currency: string): Money => money("0", currency);

function sameCurrency(a: Money, b: Money): string {
  const ca = normalizeCurrency(a.currency);
  const cb = normalizeCurrency(b.currency);
  if (ca !== cb) {
    throw new MoneyError(`Cannot combine ${ca} with ${cb} — convert first.`);
  }
  return ca;
}

export const addMoney = (a: Money, b: Money): Money =>
  money(toBigInt(a.amountMinor) + toBigInt(b.amountMinor), sameCurrency(a, b));

export const subtractMoney = (a: Money, b: Money): Money =>
  money(toBigInt(a.amountMinor) - toBigInt(b.amountMinor), sameCurrency(a, b));

/** -1 | 0 | 1, so callers can sort and compare without touching BigInt. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b);
  const x = toBigInt(a.amountMinor);
  const y = toBigInt(b.amountMinor);
  return x < y ? -1 : x > y ? 1 : 0;
}

export const isZeroMoney = (m: Money): boolean =>
  toBigInt(m.amountMinor) === 0n;
export const isNegativeMoney = (m: Money): boolean =>
  toBigInt(m.amountMinor) < 0n;
export const negateMoney = (m: Money): Money =>
  money(-toBigInt(m.amountMinor), m.currency);

/* ------------------------------------------------------------------- parse */

export interface ParseOptions {
  /**
   * What to do with more decimal places than the currency has.
   * `"reject"` (default) throws — silently dropping a user's digits is how
   * ₦100.999 becomes a support ticket. `"truncate"` floors toward zero.
   */
  precision?: "reject" | "truncate";
}

/**
 * Human decimal string → minor units. `"1,234.56"` NGN → `"123456"`.
 *
 * Grouping separators and surrounding whitespace are tolerated because they
 * come from real text fields; anything else is rejected. There is no float
 * anywhere in the path — the fractional digits are padded and concatenated as
 * text, then handed to BigInt.
 */
export function parseMinor(
  input: string,
  currency: string,
  options: ParseOptions = {},
): string {
  const decimals = requireDecimals(currency);
  const cleaned = input.trim().replace(/[\s,_]/g, "");
  if (cleaned === "" || cleaned === "-") {
    throw new MoneyError(`"${input}" is not an amount.`);
  }

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match)
    throw new MoneyError(`"${input}" is not a valid ${currency} amount.`);

  const [, sign, whole = "", fraction = ""] = match;
  if (whole === "" && fraction === "") {
    throw new MoneyError(`"${input}" is not a valid ${currency} amount.`);
  }

  let fractionDigits = fraction;
  if (fractionDigits.length > decimals) {
    if (options.precision !== "truncate") {
      throw new MoneyError(
        `${currency} has ${decimals} decimal place${decimals === 1 ? "" : "s"}; "${input}" has ${fractionDigits.length}.`,
      );
    }
    fractionDigits = fractionDigits.slice(0, decimals);
  }

  const padded = fractionDigits.padEnd(decimals, "0");
  const digits = `${whole || "0"}${padded}`;
  // Re-parse through BigInt so "000123" normalises and the sign is applied once.
  const value = BigInt(digits) * (sign === "-" ? -1n : 1n);
  return value.toString();
}

export const parseMoney = (
  input: string,
  currency: string,
  options?: ParseOptions,
): Money => money(parseMinor(input, currency, options), currency);

/* ------------------------------------------------------------------ format */

export interface FormatOptions {
  /** Thousands separators. Default `true`. */
  grouping?: boolean;
  /**
   * Fraction digits to show. Defaults to the currency's own exponent, except
   * for 6+ decimal assets where trailing zeros are trimmed to `minFraction`.
   */
  fractionDigits?: number;
  /** Floor for trimmed fractions on high-precision assets. Default `2`. */
  minFractionDigits?: number;
  /** Prefix the symbol (or code). Default `false` — `formatMoney` does that. */
  symbol?: boolean;
}

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Minor units → a decimal string. `"123456"` NGN → `"1,234.56"`.
 *
 * Note the sign handling: `-1n / 100n` is `0n` in BigInt, so the magnitude is
 * taken first and the minus re-applied to the finished text. Splitting a
 * negative balance with plain division prints `-0.50` as `0.-50`.
 */
export function formatMinor(
  amountMinor: string,
  currency: string,
  options: FormatOptions = {},
): string {
  const decimals = requireDecimals(currency);
  const value = toBigInt(amountMinor);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;

  const scale = 10n ** BigInt(decimals);
  const whole = (magnitude / scale).toString();
  const fraction =
    decimals === 0
      ? ""
      : (magnitude % scale).toString().padStart(decimals, "0");

  let shown = options.fractionDigits ?? decimals;
  if (options.fractionDigits === undefined && decimals > 2) {
    // 1.500000 USDC reads as noise; 1.50 does not. Trim, but never below the
    // floor, and never so far that a non-zero amount renders as 0.
    const min = options.minFractionDigits ?? 2;
    let end = fraction.length;
    while (end > min && fraction[end - 1] === "0") end -= 1;
    shown = end;
  }

  const head = options.grouping === false ? whole : group(whole);
  const tail =
    shown > 0 ? `.${fraction.slice(0, shown).padEnd(shown, "0")}` : "";
  const body = `${head}${tail}`;
  const prefix = options.symbol ? symbolFor(currency) : "";
  return `${negative ? "-" : ""}${prefix}${body}`;
}

export const symbolFor = (currency: string): string =>
  SYMBOLS[normalizeCurrency(currency)] ?? `${normalizeCurrency(currency)} `;

/**
 * Display helper that never throws.
 *
 * `formatMinor` throws on an unknown currency by design — inventing an exponent
 * misstates an amount by orders of magnitude. But a list row must still render,
 * so this falls back to the raw minor value labelled as such. Ugly on purpose:
 * a reviewer seeing `12345 (XAF minor units)` files a bug, where `123.45`
 * would have looked fine and been wrong.
 */
export function formatMoney(
  m: Money | null | undefined,
  options?: FormatOptions,
): string {
  if (!m) return "—";
  try {
    return formatMinor(m.amountMinor, m.currency, { symbol: true, ...options });
  } catch {
    return `${m.amountMinor} (${normalizeCurrency(m.currency)} minor units)`;
  }
}
