import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import SendConfirmScreen from "@/screens/SendConfirmScreen";

export default function SendConfirm() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <SendConfirmScreen
        onBack={() => router.back()}
        onConfirm={() => router.dismissTo("/hub")}
      />
    </SafeAreaView>
  );
}
