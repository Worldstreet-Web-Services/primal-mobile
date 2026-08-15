// Amount arithmetic stays in bigints end-to-end. `balance` floats are for
// display only — using them for a "max" send produces amounts like
// 1.9704166976000002 and can exceed what the wallet actually holds (Ark's
// tokenAmount lesson, ported).

/** Keypad digits (integer count of display units) → token base units. */
export function displayToBase(
  rawDigits: string,
  displayDecimals: number,
  tokenDecimals: number,
): bigint {
  let digits: bigint;
  try {
    digits = BigInt(rawDigits || "0");
  } catch {
    return 0n;
  }
  return digits * 10n ** BigInt(tokenDecimals - displayDecimals);
}

/** Token base units → keypad digits, floored (never rounding up) so the
 * result stays within the actual balance. */
export function baseToDisplayFloor(
  rawBalance: string,
  displayDecimals: number,
  tokenDecimals: number,
): string {
  let raw: bigint;
  try {
    raw = BigInt(rawBalance);
  } catch {
    return "0";
  }
  return (raw / 10n ** BigInt(tokenDecimals - displayDecimals)).toString();
}

/** Human quantity for a row: more precision the smaller the number. */
export function formatAmount(value: number): string {
  if (!value || !isFinite(value)) return "0";
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}
