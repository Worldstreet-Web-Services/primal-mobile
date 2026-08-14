import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FundScreen from "@/screens/FundScreen";

// The money-in hub: bank transfer, card top-up, crypto deposit.
export default function Fund() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <FundScreen
        onBack={() => router.back()}
        onOpenReceive={() => router.push("/receive")}
      />
    </SafeAreaView>
  );
}
