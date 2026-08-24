/**
 * The one timestamp converter. Pure, dependency-free, unit-testable.
 *
 * The gateway speaks two dialects and both reach the same screens:
 * subscription and payment times are protobuf timestamps
 * (`{ seconds: "1755300000", nanos: 0 }`, seconds sometimes stringified
 * because they overflow a JSON number in other languages), while auth expiries
 * are ISO-8601 strings. Every call site that hand-rolls its own `new Date(x)`
 * gets one of the two wrong, so there is exactly one entry point here:
 * `toDate`.
 */

import type { ProtoTimestamp, WireTimestamp } from "./types";

/** Milliseconds a token must still have left to count as usable. */
export const CLOCK_SKEW_MS = 30_000;

function isProtoTimestamp(value: unknown): value is ProtoTimestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    "seconds" in (value as Record<string, unknown>)
  );
}

/**
 * Protobuf timestamp → `Date`, or `null` if it isn't one.
 *
 * Seconds go through `Number` deliberately: ~1.7e9 seconds is 1.7e12
 * milliseconds, comfortably inside `Number.MAX_SAFE_INTEGER`, so there is no
 * precision to lose. Nanos are floored to whole milliseconds — `Date` has no
 * finer resolution and rounding up could push an expiry into the future.
 */
export function protoTimestampToDate(
  ts: ProtoTimestamp | null | undefined,
): Date | null {
  if (!ts) return null;
  const seconds =
    typeof ts.seconds === "string" ? Number(ts.seconds) : ts.seconds;
  if (!Number.isFinite(seconds)) return null;
  const nanos =
    typeof ts.nanos === "number" && Number.isFinite(ts.nanos) ? ts.nanos : 0;
  const ms = seconds * 1000 + Math.floor(nanos / 1_000_000);
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Anything the gateway calls a moment in time → `Date | null`.
 *
 * Accepts a protobuf timestamp, an ISO string, or epoch seconds/milliseconds as
 * a number. Bare numbers are disambiguated by magnitude: anything below 1e11 is
 * seconds (1e11 ms is 1973; 1e11 s is the year 5138 — no real timestamp is
 * ambiguous between the two).
 */
export function toDate(value: WireTimestamp): Date | null {
  if (value === null || value === undefined) return null;

  // Already converted once. Returning null here instead would make
  // `isExpired(someDate)` answer "expired" for a perfectly live timestamp.
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;

  if (isProtoTimestamp(value)) return protoTimestampToDate(value);

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const ms = Math.abs(value) < 1e11 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    // A stringified epoch, which some proto encoders emit for a bare field.
    if (/^-?\d+$/.test(trimmed)) return toDate(Number(trimmed));
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export const toMillis = (value: WireTimestamp): number | null =>
  toDate(value)?.getTime() ?? null;

export function toProtoTimestamp(date: Date): ProtoTimestamp {
  const ms = date.getTime();
  const seconds = Math.floor(ms / 1000);
  return { seconds: String(seconds), nanos: (ms - seconds * 1000) * 1_000_000 };
}

/**
 * Has this moment passed, allowing for clock skew?
 *
 * A missing timestamp counts as expired. That is the safe default for the only
 * thing that asks — an access token with no known expiry is one we cannot
 * vouch for, and treating it as live means firing a request we know may 401.
 */
export function isExpired(
  value: WireTimestamp,
  skewMs: number = CLOCK_SKEW_MS,
): boolean {
  const ms = toMillis(value);
  if (ms === null) return true;
  return ms - skewMs <= Date.now();
}

/** Milliseconds until `value`, floored at 0. `null` if it isn't a time. */
export function millisUntil(value: WireTimestamp): number | null {
  const ms = toMillis(value);
  if (ms === null) return null;
  return Math.max(0, ms - Date.now());
}

/**
 * Coarse relative phrasing for pending states ("expires in 4 min").
 * Deliberately blunt — a payment window is not a place for "in a few moments".
 */
export function formatCountdown(value: WireTimestamp): string {
  const remaining = millisUntil(value);
  if (remaining === null) return "—";
  if (remaining === 0) return "expired";

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}
