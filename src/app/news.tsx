import { router } from "expo-router";
import { View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import NewsScreen from "@/screens/NewsScreen";
import { C } from "@/theme/tokens";

export default function News() {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <PageHeader title="News" onBack={() => router.back()} />
      <NewsScreen onBack={() => router.back()} />
    </View>
  );
}
