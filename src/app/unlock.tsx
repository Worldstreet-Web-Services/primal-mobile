import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import UnlockScreen from "@/screens/UnlockScreen";

export default function Unlock() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      {/* Same landing as the first-run exit in passkey.tsx — both auth exits
          go to the tab shell. */}
      <UnlockScreen onUnlock={() => router.replace("/home")} />
    </SafeAreaView>
  );
}
