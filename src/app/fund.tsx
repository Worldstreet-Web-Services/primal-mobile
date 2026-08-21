import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FundScreen from "@/screens/FundScreen";
import { C } from "@/theme/tokens";

// The money-in hub: pick a method, then walk the crypto flow in place.
// Bank transfer gets its own screen — amount, one-off account, settle.
export default function Fund() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <FundScreen
        onBack={() => router.back()}
        onBankTransfer={() => router.push("/fund-bank")}
        onOpenReceive={() => router.push("/receive")}
      />
    </SafeAreaView>
  );
}
