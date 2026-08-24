import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import SendScreen from "@/screens/SendScreen";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";

// Naira payout: bank → account number → the name the bank returned → amount.
// The screen writes the draft; the confirm route reads it.
export default function Send() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <SendScreen
        onBack={() => router.back()}
        onContinue={() => router.push("/send-confirm")}
        // The gateway refused on entitlement, and the contract's rule is
        // "403 ACTIVE_SUBSCRIPTION_REQUIRED -> subscription screen". A toast
        // explained the refusal and left the member nowhere to go.
        onNeedsSubscription={() => router.push(SUBSCRIPTION_ROUTE)}
      />
    </SafeAreaView>
  );
}
