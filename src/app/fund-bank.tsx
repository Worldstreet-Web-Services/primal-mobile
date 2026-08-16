import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import FundBankScreen from "@/screens/FundBankScreen";

// Bank-transfer funding: the user's real provisioned account, then the
// provider's own DETECTED → CREDITED narration. Deposits are provider-initiated
// — nothing here asks for an amount, because nothing on the rail wants one.
export default function FundBank() {
  const toast = useToast();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <FundBankScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/home")}
        onProvision={() => router.push("/kyc")}
        onNeedsSubscription={() =>
          toast.info("Subscription required", "Naira deposits need an active subscription.")
        }
        onNeedsSignIn={() => router.push("/signin")}
      />
    </SafeAreaView>
  );
}
