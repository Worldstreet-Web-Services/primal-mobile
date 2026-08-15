import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import BuyScreen from "@/screens/BuyScreen";

export default function Buy() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <BuyScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/crypto")}
      />
    </SafeAreaView>
  );
}
