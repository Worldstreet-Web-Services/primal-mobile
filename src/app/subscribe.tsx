import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";
import CheckoutSheet from "@/screens/CheckoutSheet";
import SubscriptionScreen from "@/screens/SubscriptionScreen";
import { C } from "@/theme/tokens";

/**
 * `/subscribe` — the destination `SUBSCRIPTION_ROUTE` has always named.
 *
 * Until this file existed, every surface that hit a 403 ACTIVE_SUBSCRIPTION_REQUIRED
 * (fiat, kyc, fund-bank, send, send-confirm, bills) could only say "subscription
 * required" in a toast: the refusal was explained and the way out led nowhere.
 * The one thing this route has to do is exist.
 *
 * It stays thin on purpose. The screens read the gateway; this reads the app's
 * one entitlement authority (`primal.state` on AuthContext) and does the
 * navigating, because navigation is a route's job and entitlement is nobody's
 * but the backend's.
 *
 * **The checkout is a drawer here, not a push.** It began as its own route under
 * a `transparentModal`, and the native stack tore the paywall down the moment
 * the modal was on top — so the "transparent" backdrop revealed the bare window
 * and the whole thing read as a second page. Paying is a step WITHIN the
 * decision to subscribe, so the sheet is mounted over this screen and the
 * paywall stays behind it, dimmed by the sheet's own scrim. `/checkout` still
 * exists for a deep link or a relaunch mid-payment, where there is genuinely no
 * paywall to sit on.
 */
export default function Subscribe() {
  const { primal, addresses, refreshEntitlement } = useAuth();

  /**
   * `null` means closed. A string is the subscription the sheet should resume;
   * the empty string is "open, with nothing to resume" — the gateway client
   * still recovers its own persisted intent, so this is a hint, not a contract.
   * Nothing here creates a checkout.
   */
  const [checkout, setCheckout] = useState<string | null>(null);

  const close = useCallback(() => setCheckout(null), []);

  const entitled = useCallback(() => {
    // The gateway is the only authority on entitlement, so ask it again rather
    // than assuming a settled payment has propagated yet.
    void refreshEntitlement();
    setCheckout(null);
    router.push("/welcome-aboard");
  }, [refreshEntitlement]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <SubscriptionScreen
        state={primal.state}
        onCheckout={(subscriptionId) => setCheckout(subscriptionId ?? "")}
        // Six screens push here, and a seventh path is the deep link — which has
        // no back stack at all. Falling back to the hub keeps the paywall from
        // being a room with no door.
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/hub"))}
        // A dead session is not a paywall. `replace`, so a signed-out user cannot
        // swipe back into a screen that will only refuse them again.
        onSignIn={() => router.replace("/signin")}
        onEntitlementChanged={refreshEntitlement}
      />

      {checkout === null ? null : (
        <View style={StyleSheetAbsolute}>
          <CheckoutSheet
            subscriptionId={checkout === "" ? null : checkout}
            // A failed route refunds to the user's own wallet. Null until Decane
            // has one, which the sheet reports rather than papering over.
            walletAddress={addresses?.evm ?? null}
            onBack={close}
            onClose={close}
            onSignIn={() => router.replace("/signin")}
            onEntitled={entitled}
          />
        </View>
      )}
    </View>
  );
}

/** The drawer fills the screen; the sheet inside it does the bottom-anchoring. */
const StyleSheetAbsolute = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
