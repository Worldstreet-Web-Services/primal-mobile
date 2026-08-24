import { router } from "expo-router";
import { View } from "react-native";

import PodcastScreen from "@/screens/PodcastScreen";

/* Full-bleed by design — the rails run to both edges, so the screen applies
   the insets itself. */
export default function Podcast() {
  // Both the featured card and the wall open the episode page rather than
  // starting playback on the spot: the tap says "this one", and what to do
  // with it is a decision the episode page presents.
  const open = (key: string) => router.push(`/podcast/${key}`);

  return (
    <View className="flex-1 bg-canvas">
      <PodcastScreen
        unread
        onNotifications={() => router.push("/pulse")}
        onPlayFeatured={open}
        onOpenEpisode={open}
      />
    </View>
  );
}
