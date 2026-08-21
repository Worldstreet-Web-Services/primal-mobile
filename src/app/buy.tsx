import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import BuyScreen from "@/screens/BuyScreen";
import { C } from "@/theme/tokens";

export default function Buy() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <BuyScreen
        onBack={() => router.back()}
        onDone={() => router.dismissTo("/crypto")}
      />
    </SafeAreaView>
  );
}
