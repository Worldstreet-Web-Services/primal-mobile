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
 * The subscription screen.
 *
 * It lands in a parallel workstream, so `src/app/subscribe.tsx` does not exist
 * yet and the path is not in expo-router's generated route union. Widening to
 * `string` and back is the seam that lets this compile in the meantime; the
 * moment the route file exists, delete the two assertions and the literal types
 * itself. Keeping it in one place is the point — nothing else in the app should
 * carry a hand-written subscription path.
 */
export const SUBSCRIPTION_ROUTE = "/subscribe" as string as Href;
