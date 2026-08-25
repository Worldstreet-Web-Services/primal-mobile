import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import WithdrawalHubScreen from "@/screens/WithdrawalHubScreen";
import { C } from "@/theme/tokens";

export default function Withdraw() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <WithdrawalHubScreen
        onBack={() => router.back()}
        onBank={() => router.push("/send")}
      />
    </SafeAreaView>
  );
}
