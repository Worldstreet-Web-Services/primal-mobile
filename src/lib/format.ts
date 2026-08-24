/**
 * Money the app typed itself.
 *
 * Everything sourced arrives preformatted — the engine speaks decimal strings
 * and the UI never rounds them. These two exist for the one case with no source
 * behind it: a figure the MEMBER typed, restated back to them. The copy-trading
 * stake is the whole reason they exist, and both screens in that flow have to
 * state it the same way, so it is written once here rather than twice there.
 */

/** `$1,234.50`. */
export function money(value: number): string {
  const [whole, cents] = value.toFixed(2).split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}

/**
 * The same figure without a trailing `.00`. In a sentence, decimals on a round
 * number read as noise; in a receipt they are the point.
 */
export function moneyShort(value: number): string {
  return Number.isInteger(value) ? money(value).slice(0, -3) : money(value);
}
