/**
 * Development-only escape hatches.
 *
 * Every flag here is inert unless BOTH `__DEV__` is true AND the flag is set in
 * `.env`. Nothing in this file can change behaviour in a release build, which is
 * the only property that makes it safe to have at all.
 */

const on = (value: string | undefined): boolean =>
  __DEV__ && (value === "1" || value === "true");

/**
 * Walk past the membership gate without paying.
 *
 * WHAT THIS DOES: lets `index.tsx` route an unentitled account into the app
 * instead of holding it at `/subscribe`.
 *
 * WHAT THIS DOES NOT DO, AND CANNOT: make the paid surface work. Entitlement is
 * enforced by the BACKEND — every `/v1/linkpay/*` route asks User Management
 * before it does anything, so with this flag on, Fiat, KYC, Fund, Send and Bills
 * will still answer 403 on every request. The flag buys access to the surfaces
 * that never needed entitlement in the first place: crypto, Last Man Standing,
 * home, profile and navigation. Anyone expecting it to unlock naira features
 * will conclude the app is broken, so it says so out loud below.
 *
 * The subscription flow itself must still be proven end to end for real. This
 * exists so that work is not the only thing anyone can test.
 */
export const skipPaywall = on(process.env.EXPO_PUBLIC_DEV_SKIP_PAYWALL);

let announced = false;

/** Log the bypass once per launch, so a dev session cannot be mistaken for a real one. */
export function announceDevMode(): void {
  if (!skipPaywall || announced) return;
  announced = true;
  console.warn(
    "[dev] EXPO_PUBLIC_DEV_SKIP_PAYWALL is on — the membership gate is bypassed. " +
      "LinkPay routes (fiat, kyc, fund, send, bills) will still return 403 from " +
      "the gateway; only wallet-side surfaces are usable. Never ship this.",
  );
}
