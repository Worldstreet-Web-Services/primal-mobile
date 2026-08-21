import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
import { refundAddress } from "@/lib/gateway/devRefund";
import CheckoutSheet from "@/screens/CheckoutSheet";

/**
 * The crypto checkout, presented over the paywall it came from.
 *
 * Transparent by design: the membership screen stays mounted and dimmed behind
 * the sheet, so paying reads as a step within the decision rather than a
 * separate place the user has been taken to.
 *
 * Open it with the subscription that owns the payment:
 *
 *     router.push({ pathname: "/checkout", params: { subscription: id } })
 *
 * Opened bare — a deep link, or a relaunch mid-payment — it resumes whatever
 * this device already has. It never creates a second checkout either way.
 */

export default function Checkout() {
  const { subscription } = useLocalSearchParams<{ subscription?: string }>();
  const { addresses, status, refreshEntitlement } = useAuth();

  /** Back and close land in the same place: there is one screen behind this. */
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    // "/" rather than a screen chosen here: the entry gate is the one thing
    // that knows whether this account belongs in the app, at the paywall, or
    // back at sign-in. Naming a destination is how a deep link out of checkout
    // used to land on a stale hub nothing else in the app links to.
    else router.replace("/");
  }, []);

  // Reached ONLY when the gateway itself confirmed entitlement — never from a
  // settled payment, a transaction hash, or a wallet's own confirmation.
  const entitled = useCallback(() => {
    // Let the rest of the app hear it from the gateway too, so no other screen
    // is left holding a stale "unpaid" while this one moves on.
    void refreshEntitlement();
    // `replace`, not `push`: this checkout has concluded, and leaving it under
    // the welcome beat means a back gesture returns to a paid deposit address
    // still telling the user to send money.
    router.replace("/welcome-aboard");
  }, [refreshEntitlement]);

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "transparentModal",
          // The scrim fades; the panel's own rise is animated inside the sheet.
          // A stack transition here would slide the scrim too, which reads as a
          // page swap rather than a drawer.
          animation: "fade",
          // The root stack paints C.canvas; the sheet needs the paywall behind
          // it to show through its own scrim.
          contentStyle: { backgroundColor: "transparent" },
          // NOTE: this route is the deep-link / relaunch-mid-payment entry only.
          // The native stack tears the previous screen down once a modal is on
          // top, so nothing shows through the transparency here — which is why
          // the normal path mounts this same sheet as a drawer inside
          // `/subscribe` instead of pushing at this route.
        }}
      />
      <CheckoutSheet
        subscriptionId={subscription ?? null}
        // A failed route refunds to the user's own wallet. Null until Decane
        // has one, which the sheet reports rather than papering over.
        walletAddress={refundAddress(addresses?.evm ?? null)}
        // Null covers two different states and they need different words:
        // nobody signed in, versus a signed-in wallet still behind the lock.
        signedOut={status === "signedOut"}
        onBack={leave}
        onClose={leave}
        onSignIn={() => router.replace("/signin")}
        onEntitled={entitled}
      />
    </>
  );
}
