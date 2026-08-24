import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import { Body } from "@/components/ui";
import { episodeById } from "@/data/podcast";
import EpisodeScreen from "@/screens/EpisodeScreen";

/**
 * One episode. Every tap on the podcast tab that names an episode lands here —
 * the featured card and the tiles on the wall — because the description, the
 * chapters and the decision to actually start listening belong on a page, not
 * in a list.
 *
 * Playing from here hands the episode to the transport store, which outlives
 * this route: leave the page and the mini bar carries it (see
 * `components/podcast/PlayerHost`).
 */
export default function Episode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const episode = id ? episodeById(id) : undefined;

  if (!episode) {
    return (
      <View className="flex-1 bg-canvas">
        <PageHeader title="Podcast" align="left" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <Body className="text-[14px] text-sub">
            That episode is no longer listed.
          </Body>
        </View>
      </View>
    );
  }

  return <EpisodeScreen episode={episode} onBack={() => router.back()} />;
}
