import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import WithdrawScreen from "@/screens/WithdrawScreen";
import { C } from "@/theme/tokens";

export default function Withdraw() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <WithdrawScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/crypto")}
      />
    </SafeAreaView>
  );
}
