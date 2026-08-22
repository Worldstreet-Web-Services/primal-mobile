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

/**
 * Fill the home screen's "Recent Transaction" card with sample rows.
 *
 * WHAT THIS IS FOR: comparing the built screen against the design reference.
 * The card's real source does not exist yet — the gateway surface is
 * `/v1/auth/*`, `/v1/linkpay/*` and `/v1/subscriptions/*`, none of which
 * returns a ledger — so without this the card shows its empty state, which is
 * the correct thing for it to show and the wrong thing for judging a layout.
 *
 * WHAT IT IS NOT: data. Every row it renders is invented, and rows about
 * someone's money are the exact class of thing this app removed from home once
 * already (see the doctrine note in `PortfolioCard`). It is gated the same way
 * as the paywall bypass — dev build AND an explicit flag — so it cannot reach
 * anyone but the person who typed it into their own `.env`.
 */
export const sampleActivity = on(process.env.EXPO_PUBLIC_DEV_SAMPLE_ACTIVITY);

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

/* ------------------------------------------------------- placeholder auth */

const explicitlyOff = (value: string | undefined): boolean =>
  value === "0" || value === "false";

/** Decane can only run when BOTH of its credentials are present. */
const decaneConfigured =
  (process.env.EXPO_PUBLIC_DECANE_APP_ID ?? "") !== "" &&
  (process.env.EXPO_PUBLIC_DECANE_API_KEY ?? "") !== "";

/**
 * Run the whole identity stack — wallet AND gateway — against stand-ins that
 * live on the device.
 *
 * WHAT THIS DOES: sign-in mints a placeholder wallet instead of calling Decane,
 * and every request `src/lib/gateway/client.ts` would put on the wire is
 * answered by `src/lib/gateway/placeholder.ts` instead. The app then walks its
 * REAL onboarding sequence end to end — sign in, set a PIN, offer biometric
 * unlock, pay, welcome aboard — with no backend of any kind reachable.
 *
 * WHAT THIS IS NOT: a bypass of any check. Every gate still runs and still has
 * to be satisfied; what changes is who answers. Nothing here weakens the real
 * path — the moment Decane's credentials are set, this switches itself off.
 *
 * WHY IT DEFAULTS ON WHEN DECANE IS UNCONFIGURED: without credentials the SDK
 * cannot initialise at all, so the alternative to a stand-in is an app that
 * cannot get past its first screen. Set `EXPO_PUBLIC_DEV_PLACEHOLDER_AUTH=0` to
 * refuse the fallback and see the real failure instead.
 *
 * `__DEV__` is load-bearing, exactly as it is for the flags above: a release
 * build has no placeholder identity, whatever the environment says.
 */
export const placeholderAuth =
  __DEV__ &&
  !explicitlyOff(process.env.EXPO_PUBLIC_DEV_PLACEHOLDER_AUTH) &&
  (on(process.env.EXPO_PUBLIC_DEV_PLACEHOLDER_AUTH) || !decaneConfigured);

let placeholderAnnounced = false;

/** Log the stand-in once per launch, so a dev session cannot be mistaken for a real one. */
export function announcePlaceholderAuth(): void {
  if (!placeholderAuth || placeholderAnnounced) return;
  placeholderAnnounced = true;
  console.warn(
    "[dev] PLACEHOLDER IDENTITY is on — sign-in mints a fake wallet and every " +
      "gateway request is answered on-device. No Decane, no api.tsion.io, no " +
      "real money, and no address here can receive any. Never ship this.",
  );
}
