import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import CrossBorderScreen from "@/screens/CrossBorderScreen";
import { C } from "@/theme/tokens";

// Cross-border remit: provider-priced quote + status timeline.
export default function Remit() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <CrossBorderScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
