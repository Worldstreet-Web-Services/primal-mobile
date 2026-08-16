import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import KycScreen from "@/screens/KycScreen";

// Opening the LinkPay naira account: name, phone, email, BVN. The screen owns
// the idempotency key and the resumable statuses; this route only decides where
// the user goes when it is done.
export default function Kyc() {
  const toast = useToast();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <KycScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/fiat")}
        onNeedsSubscription={() =>
          toast.info("Subscription required", "A naira account needs an active subscription.")
        }
        onNeedsSignIn={() => router.push("/signin")}
      />
    </SafeAreaView>
  );
}
