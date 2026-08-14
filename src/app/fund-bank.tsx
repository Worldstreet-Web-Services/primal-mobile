import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FundBankScreen from "@/screens/FundBankScreen";

// Bank-transfer funding: amount → one-off account → funds received.
export default function FundBank() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <FundBankScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/home")}
      />
    </SafeAreaView>
  );
}
