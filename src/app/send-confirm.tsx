import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import SendConfirmScreen from "@/screens/SendConfirmScreen";
import { C } from "@/theme/tokens";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";

// The payout's last look, and its whole life after that: quote, PIN, initiate,
// then poll to SETTLED / FAILED / REVERSED. `onDone` fires on an outcome the
// user has already been shown, so this only has to leave.
export default function SendConfirm() {

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <SendConfirmScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/fiat")}
        // The gateway refused on entitlement, and the contract's rule is
        // "403 ACTIVE_SUBSCRIPTION_REQUIRED -> subscription screen". A toast
        // explained the refusal and left the member nowhere to go.
        onNeedsSubscription={() => router.push(SUBSCRIPTION_ROUTE)}
      />
    </SafeAreaView>
  );
}
