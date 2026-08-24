import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";
import { isEntitled } from "@/lib/gateway/types";
import { refundAddress } from "@/lib/gateway/devRefund";
import CheckoutSheet from "@/screens/CheckoutSheet";
import SubscriptionScreen from "@/screens/SubscriptionScreen";

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
  const { primal, addresses, status, signOut, refreshEntitlement } = useAuth();

  /**
   * Is there anything behind this screen to go back TO?
   *
   * The test is entitlement, not onboarding. An earlier version asked whether
   * the PIN had been set, which quietly failed for the commonest case of all: a
   * member who finished onboarding and then lapsed is `ready`, so "Close" fell
   * through to a fallback route and let them out into an app that would refuse
   * them on every screen. While the gateway says they are not entitled, this
   * screen IS the app, and the only honest way past it is out of the account.
   */
  const barred = !isEntitled(primal.state);

  /**
   * `null` means closed. A string is the subscription the sheet should resume;
   * the empty string is "open, with nothing to resume" — the gateway client
   * still recovers its own persisted intent, so this is a hint, not a contract.
   * Nothing here creates a checkout.
   */
  const [checkout, setCheckout] = useState<string | null>(null);

  const close = useCallback(() => setCheckout(null), []);

  /**
   * The only honest exit from the gate — see `barred` above.
   *
   * A plain sign-out: the app lock stays on the device, so someone who backed
   * out at the paywall and later decides to pay signs in and is straight back
   * here, rather than re-creating a PIN to reach a screen they have already
   * seen. Navigating explicitly because nothing else will — this route has no
   * redirect of its own, and without it signing out leaves the paywall on
   * screen with no session behind it.
   */
  const leave = useCallback(async () => {
    await signOut();
    router.replace("/signin");
  }, [signOut]);

  const entitled = useCallback(() => {
    // The gateway is the only authority on entitlement, so ask it again rather
    // than assuming a settled payment has propagated yet.
    void refreshEntitlement();
    // Once the account is open, the paywall and the drawer over it are both
    // spent. Closing the sheet first means this screen is already on its MEMBER
    // face for the frames the transition is running — and `replace`, not
    // `push`, so a back gesture cannot land the user on a checkout they have
    // already paid, over a paywall that no longer applies to them.
    setCheckout(null);
    router.replace("/welcome-aboard");
  }, [refreshEntitlement]);

  return (
    <View className="flex-1 bg-canvas">
      <SubscriptionScreen
        state={primal.state}
        onCheckout={(subscriptionId) => setCheckout(subscriptionId ?? "")}
        // Two different situations wear the same button.
        //
        // Mid-app (a naira screen 403'd and pushed here) Back means "return to
        // what I was doing". But at the DOOR — signed in, app lock set,
        // membership unpaid — there is nothing behind this screen: it is the
        // gate. Falling back to /home there would walk an unpaid user straight
        // into the app the gate exists to hold, so the only honest exit is out
        // of the account entirely.
        onBack={
          barred
            ? () => void leave()
            : () =>
                router.canGoBack() ? router.back() : router.replace("/home")
        }
        backLabel={barred ? "Sign out" : "Close"}
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
            walletAddress={refundAddress(addresses?.evm ?? null)}
            // Null covers two different states and they need different words:
            // nobody signed in, versus a signed-in wallet still behind the lock.
            signedOut={status === "signedOut"}
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
