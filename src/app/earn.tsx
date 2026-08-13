import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import EarnSpaceScreen from "@/screens/EarnSpaceScreen";

export default function Earn() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <EarnSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
