import { router } from "expo-router";

import { PageHeader } from "@/components/PageHeader";
import NewsScreen from "@/screens/NewsScreen";
import { View } from "react-native";

export default function News() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <PageHeader title="News" onBack={() => router.back()} />
      <NewsScreen onBack={() => router.back()} />
    </View>
  );
}
