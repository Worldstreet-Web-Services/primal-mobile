import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import CryptoSpaceScreen from "@/screens/CryptoSpaceScreen";

export default function Crypto() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <CryptoSpaceScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
