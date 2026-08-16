import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import PodcastScreen from "@/screens/PodcastScreen";
import { C } from "@/theme/tokens";

export default function Podcast() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <PodcastScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
