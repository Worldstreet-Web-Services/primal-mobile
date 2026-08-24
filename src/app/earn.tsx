import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import EarnSpaceScreen from "@/screens/EarnSpaceScreen";

export default function Earn() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <EarnSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
