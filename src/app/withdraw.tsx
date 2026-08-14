import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import WithdrawScreen from "@/screens/WithdrawScreen";

export default function Withdraw() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <WithdrawScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/crypto")}
      />
    </SafeAreaView>
  );
}
