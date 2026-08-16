import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import TradeSpaceScreen from "@/screens/TradeSpaceScreen";
import { C } from "@/theme/tokens";

export default function Trade() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <TradeSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
