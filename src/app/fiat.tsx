import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FiatSpaceScreen from "@/screens/FiatSpaceScreen";

// The LinkPay-powered fiat space: account number, deposits, activity.
export default function Fiat() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <FiatSpaceScreen
        onBack={() => router.back()}
        onAdd={() => router.push("/receive")}
        onSend={() => router.push("/send")}
        onRemit={() => router.push("/remit")}
      />
    </SafeAreaView>
  );
}
