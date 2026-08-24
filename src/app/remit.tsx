import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import CrossBorderScreen from "@/screens/CrossBorderScreen";

// Cross-border remit: provider-priced quote + status timeline.
export default function Remit() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <CrossBorderScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
