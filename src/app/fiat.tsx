import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import FiatSpaceScreen from "@/screens/FiatSpaceScreen";

export default function Fiat() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <FiatSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
