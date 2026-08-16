import { router, type Href } from "expo-router";

import { useAuth } from "@/lib/auth/AuthContext";
import SubscriptionScreen from "@/screens/SubscriptionScreen";

/**
 * `/subscribe` — the destination `SUBSCRIPTION_ROUTE` has always named.
 *
 * Until this file existed, every surface that hit a 403 ACTIVE_SUBSCRIPTION_REQUIRED
 * (fiat, kyc, fund-bank, send, send-confirm, bills) could only say "subscription
 * required" in a toast: the refusal was explained and the way out led nowhere.
 * The one thing this route has to do is exist.
 *
 * It stays thin on purpose. The screen reads the gateway; this reads the app's
 * one entitlement authority (`primal.state` on AuthContext) and does the
 * navigating, because navigation is a route's job and entitlement is nobody's
 * but the backend's.
 */

/**
 * A checkout this device already has open is named in the handoff, so the
 * checkout surface can resume THAT payment rather than look one up and risk
 * presenting a second deposit address. `/checkout` reads it as `subscription`.
 *
 * It is a hint, not a contract: the gateway client resumes from its own
 * persisted intent regardless, so a checkout that ignored the param would still
 * land on the same payment. Nothing here creates one.
 */
const checkoutHref = (subscriptionId: string | null): Href =>
  subscriptionId
    ? `/checkout?subscription=${encodeURIComponent(subscriptionId)}`
    : "/checkout";

export default function Subscribe() {
  const { primal, refreshEntitlement } = useAuth();

  return (
    <SubscriptionScreen
      state={primal.state}
      onCheckout={(subscriptionId) => router.push(checkoutHref(subscriptionId))}
      // Six screens push here, and a seventh path is the deep link — which has
      // no back stack at all. Falling back to the hub keeps the paywall from
      // being a room with no door.
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/hub"))}
      // A dead session is not a paywall. `replace`, so a signed-out user cannot
      // swipe back into a screen that will only refuse them again.
      onSignIn={() => router.replace("/signin")}
      onEntitlementChanged={refreshEntitlement}
    />
  );
}
