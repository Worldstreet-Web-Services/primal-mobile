import { router } from "expo-router";
import { View } from "react-native";

import PodcastScreen from "@/screens/PodcastScreen";
import { C } from "@/theme/tokens";

/* Full-bleed by design — the rails run to both edges, so the screen applies
   the insets itself. */
export default function Podcast() {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <PodcastScreen unread onNotifications={() => router.push("/pulse")} />
    </View>
  );
}
