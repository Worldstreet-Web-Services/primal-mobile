import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import SendScreen from "@/screens/SendScreen";

export default function Send() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <SendScreen
        onBack={() => router.back()}
        onContinue={() => router.push("/send-confirm")}
      />
    </SafeAreaView>
  );
}
