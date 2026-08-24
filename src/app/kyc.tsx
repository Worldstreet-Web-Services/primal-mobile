import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import KycScreen from "@/screens/KycScreen";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";

// Opening the LinkPay naira account: name, phone, email, BVN. The screen owns
// the idempotency key and the resumable statuses; this route only decides where
// the user goes when it is done.
export default function Kyc() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <KycScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/fiat")}
        // The gateway refused on entitlement, and the contract's rule is
        // "403 ACTIVE_SUBSCRIPTION_REQUIRED -> subscription screen". A toast
        // explained the refusal and left the member nowhere to go.
        onNeedsSubscription={() => router.push(SUBSCRIPTION_ROUTE)}
        onNeedsSignIn={() => router.push("/signin")}
      />
    </SafeAreaView>
  );
}
