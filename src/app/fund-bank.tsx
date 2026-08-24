import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FundBankScreen from "@/screens/FundBankScreen";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";

// Bank-transfer funding: the user's real provisioned account, then the
// provider's own DETECTED → CREDITED narration. Deposits are provider-initiated
// — nothing here asks for an amount, because nothing on the rail wants one.
export default function FundBank() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <FundBankScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/home")}
        onProvision={() => router.push("/kyc")}
        // The gateway refused on entitlement, and the contract's rule is
        // "403 ACTIVE_SUBSCRIPTION_REQUIRED -> subscription screen". A toast
        // explained the refusal and left the member nowhere to go.
        onNeedsSubscription={() => router.push(SUBSCRIPTION_ROUTE)}
        onNeedsSignIn={() => router.push("/signin")}
      />
    </SafeAreaView>
  );
}
