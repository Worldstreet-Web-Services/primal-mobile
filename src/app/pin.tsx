import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import CreatePinScreen from "@/screens/CreatePinScreen";

export default function Pin() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <CreatePinScreen onDone={() => router.push("/passkey")} />
    </SafeAreaView>
  );
}
