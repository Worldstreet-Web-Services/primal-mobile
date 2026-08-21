import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import EarnSpaceScreen from "@/screens/EarnSpaceScreen";
import { C } from "@/theme/tokens";

export default function Earn() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <EarnSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
