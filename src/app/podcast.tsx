import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import PodcastScreen from "@/screens/PodcastScreen";

export default function Podcast() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <PodcastScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
