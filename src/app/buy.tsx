import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import BuyScreen from "@/screens/BuyScreen";

export default function Buy() {
  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <BuyScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/crypto")}
      />
    </SafeAreaView>
  );
}
