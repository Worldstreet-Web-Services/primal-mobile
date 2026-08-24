import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import LastManScreen from "@/screens/LastManScreen";

export default function LastMan() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <LastManScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
