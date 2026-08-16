import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import SendConfirmScreen from "@/screens/SendConfirmScreen";

// The payout's last look, and its whole life after that: quote, PIN, initiate,
// then poll to SETTLED / FAILED / REVERSED. `onDone` fires on an outcome the
// user has already been shown, so this only has to leave.
export default function SendConfirm() {
  const toast = useToast();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <SendConfirmScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/fiat")}
        onNeedsSubscription={() =>
          toast.info("Subscription required", "Naira payouts need an active subscription.")
        }
      />
    </SafeAreaView>
  );
}
