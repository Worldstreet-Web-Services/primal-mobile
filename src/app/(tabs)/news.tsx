import { router } from "expo-router";
import { View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import NewsScreen from "@/screens/NewsScreen";

export default function News() {
  return (
    <View className="flex-1 bg-canvas">
      <PageHeader title="News" onBack={() => router.back()} />
      <NewsScreen onBack={() => router.back()} />
    </View>
  );
}
