import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import CrossBorderScreen from "@/screens/CrossBorderScreen";

// Cross-border remit: provider-priced quote + status timeline.
export default function Remit() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <CrossBorderScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
