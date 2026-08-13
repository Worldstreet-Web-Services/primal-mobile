import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import UnlockScreen from "@/screens/UnlockScreen";

export default function Unlock() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <UnlockScreen onUnlock={() => router.replace("/hub")} />
    </SafeAreaView>
  );
}
