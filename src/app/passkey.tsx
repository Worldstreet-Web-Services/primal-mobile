import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import PasskeyScreen from "@/screens/PasskeyScreen";

export default function Passkey() {
  const done = () => router.replace("/home");
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <PasskeyScreen onEnable={done} onSkip={done} />
    </SafeAreaView>
  );
}
