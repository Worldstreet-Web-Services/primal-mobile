import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import NewsScreen from "@/screens/NewsScreen";

export default function News() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <NewsScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
