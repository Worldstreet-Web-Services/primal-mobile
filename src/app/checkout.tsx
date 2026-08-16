import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";

import { useAuth } from "@/lib/auth/AuthContext";
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
  const { addresses, refreshEntitlement } = useAuth();

  /** Back and close land in the same place: there is one screen behind this. */
  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/hub");
  }, []);

  // Reached ONLY when the gateway itself confirmed entitlement — never from a
  // settled payment, a transaction hash, or a wallet's own confirmation.
  const entitled = useCallback(() => {
    // Let the rest of the app hear it from the gateway too, so no other screen
    // is left holding a stale "unpaid" while this one moves on.
    void refreshEntitlement();
    router.push("/welcome-aboard");
  }, [refreshEntitlement]);

  return (
    <>
      <Stack.Screen
        options={{
          presentation: "transparentModal",
          animation: "fade",
          // The root stack paints C.canvas; the sheet needs the paywall behind
          // it to show through its own scrim.
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
      <CheckoutSheet
        subscriptionId={subscription ?? null}
        // A failed route refunds to the user's own wallet. Null until Decane
        // has one, which the sheet reports rather than papering over.
        walletAddress={addresses?.evm ?? null}
        onBack={leave}
        onClose={leave}
        onSignIn={() => router.replace("/signin")}
        onEntitled={entitled}
      />
    </>
  );
}
