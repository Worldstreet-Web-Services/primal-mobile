import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import TradeSpaceScreen from "@/screens/TradeSpaceScreen";

export default function Trade() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <TradeSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
