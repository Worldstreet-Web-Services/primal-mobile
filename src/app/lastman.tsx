import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import LastManScreen from "@/screens/LastManScreen";
import { C } from "@/theme/tokens";

export default function LastMan() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <LastManScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
