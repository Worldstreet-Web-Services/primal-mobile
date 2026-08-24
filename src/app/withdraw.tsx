import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import WithdrawScreen from "@/screens/WithdrawScreen";

export default function Withdraw() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <WithdrawScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/crypto")}
      />
    </SafeAreaView>
  );
}
