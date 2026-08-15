import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FiatSpaceScreen from "@/screens/FiatSpaceScreen";

// Reached from the home shelf's "linkpay" tile, which already routes to /fiat.
export default function Fiat() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <FiatSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
