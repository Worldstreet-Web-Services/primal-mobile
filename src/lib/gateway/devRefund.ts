/**
 * A development-only stand-in for the wallet address a checkout refunds to.
 *
 * WHY THIS IS NOT A DEFAULT, AND MUST NEVER BECOME ONE
 *
 * `refundTo` is where the payment provider returns the money if the swap route
 * fails. The contract is explicit that it is the PAYER'S OWN wallet, and it has
 * to be: one fixed address shared by everyone means a stranger's failed $1,000
 * is refunded to whoever owns that address, not to the person who sent it. That
 * is not a bug you notice in testing — it only ever fires on a failed route, in
 * production, with someone else's money.
 *
 * So this exists purely so the checkout can be exercised on a simulator whose
 * wallet is locked (Decane hands out no addresses until it is unlocked, and the
 * gateway rejects a checkout with no `refundTo`). It is:
 *
 *   - read from the environment, never hardcoded in the app;
 *   - ignored entirely outside `__DEV__`;
 *   - ignored whenever a real wallet address exists — the real one always wins;
 *   - loud about itself in the logs, so nobody mistakes a test run for a live one.
 *
 * Set `EXPO_PUBLIC_DEV_REFUND_ADDRESS` in `.env` to use it. Leave it unset and
 * the checkout behaves exactly as it does for a user: no address, no checkout.
 */

const CONFIGURED = process.env.EXPO_PUBLIC_DEV_REFUND_ADDRESS ?? "";

/** Cheap shape check. The gateway does the authoritative EIP-55 validation. */
const LOOKS_LIKE_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

let warned = false;

/**
 * The address a checkout should refund to.
 *
 * `real` is whatever Decane currently reports. It is returned untouched whenever
 * it exists, in every build — the fallback can only ever fill a hole, never
 * replace a genuine wallet.
 */
export function refundAddress(real: string | null): string | null {
  if (real) return real;
  if (!__DEV__) return null;
  if (!LOOKS_LIKE_ADDRESS.test(CONFIGURED)) return null;

  if (!warned) {
    warned = true;
    // Deliberately a warning, not an info: a checkout created against this
    // address is a test artefact, and the log is the only thing that says so.
    console.warn(
      "[checkout] DEV refund address in use — this build refunds failed routes " +
        "to a fixed test wallet, NOT to the signed-in user. Never ship this.",
    );
  }
  return CONFIGURED;
}
