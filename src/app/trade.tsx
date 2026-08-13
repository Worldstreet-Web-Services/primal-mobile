import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import TradeSpaceScreen from "@/screens/TradeSpaceScreen";

export default function Trade() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <TradeSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
