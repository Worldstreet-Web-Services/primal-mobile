import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import SendScreen from "@/screens/SendScreen";
import { C } from "@/theme/tokens";

// Naira payout: bank → account number → the name the bank returned → amount.
// The screen writes the draft; the confirm route reads it.
export default function Send() {
  const toast = useToast();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <SendScreen
        onBack={() => router.back()}
        onContinue={() => router.push("/send-confirm")}
        onNeedsSubscription={() =>
          toast.info("Subscription required", "Naira payouts need an active subscription.")
        }
      />
    </SafeAreaView>
  );
}
