import type { Href } from "expo-router";

/**
 * Destinations that are decided by the gateway rather than by a tap.
 *
 * A 401 the client could not refresh means sign in again. A 403 means the
 * person is signed in perfectly well and has not paid — those two must never
 * share a destination, because sending an unpaid user to the sign-in screen
 * asks them to fix the one thing that isn't broken.
 */

/** Sign-in. Exists today, so expo-router types it. */
export const SIGN_IN_ROUTE: Href = "/signin";

/**
 * The subscription screen — the one place a paywall path is written down.
 *
 * Now a real route (`src/app/subscribe.tsx`), so it types itself: the widening
 * assertions that stood in while it was still a parallel workstream are gone.
 */
export const SUBSCRIPTION_ROUTE: Href = "/subscribe";
