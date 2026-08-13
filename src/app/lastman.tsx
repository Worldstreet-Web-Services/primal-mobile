import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import LastManScreen from "@/screens/LastManScreen";

export default function LastMan() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <LastManScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
