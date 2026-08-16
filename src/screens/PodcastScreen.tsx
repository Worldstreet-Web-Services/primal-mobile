import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MediaCard, type MediaItem } from "@/components/home";
import { BellIcon } from "@/components/icons";
import { CategoryTabs, SectionHeader } from "@/components/news";
import {
  AuthorRail,
  EpisodeGrid,
  type Author,
  type Episode,
} from "@/components/podcast";
import { Body, CircleAction, Display, Screen } from "@/components/ui";
import {
  authors as defaultAuthors,
  episodes as defaultEpisodes,
  nowPlaying as defaultNowPlaying,
  podcastTabs,
} from "@/data/podcast";
import { C, F } from "@/theme/tokens";

/** Page gutter. Every rail escapes it, so it has to be shared. */
const GUTTER = 18;

export interface PodcastScreenProps {
  heading?: string;
  subheading?: string;
  featured?: MediaItem;
  tabs?: string[];
  episodes?: Episode[];
  authors?: Author[];
  unread?: boolean;
  onNotifications?: () => void;
  onPlayFeatured?: (key: string) => void;
  onOpenEpisode?: (key: string) => void;
  onOpenAuthor?: (key: string) => void;
}

/**
 * Podcast discovery: what's playing now, the episode wall under its filter,
 * then the hosts. Every shelf is a standalone component and every list is a
 * prop, so this file is only layout and spacing.
 */
export default function PodcastScreen({
  heading = "Discover",
  subheading = "Enjoy your favorite podcast",
  featured = defaultNowPlaying,
  tabs = podcastTabs,
  episodes = defaultEpisodes,
  authors = defaultAuthors,
  unread = false,
  onNotifications,
  onPlayFeatured,
  onOpenEpisode,
  onOpenAuthor,
}: PodcastScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState(0);

  // Two tiles and a peek of the third, so the rail reads as scrollable.
  const tileSize = Math.round((width - GUTTER * 2 - 12) / 2.35);
  const cardWidth = width - GUTTER * 2;

  return (
    <Screen pad={GUTTER} top={insets.top + 20} bottom={insets.bottom + 40}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Display
            size={34}
            style={{ fontFamily: F.displayBold, letterSpacing: -0.4 }}
          >
            {heading.toUpperCase()}
          </Display>
          <Body
            size={16}
            color={C.sub}
            style={{ marginTop: 2, fontFamily: F.display }}
          >
            {subheading}
          </Body>
        </View>

        {/* Filled rather than outlined — it is the only control on a page of
            artwork, so it has to hold its own against the covers below. */}
        <CircleAction
          size={46}
          badge={unread}
          onPress={onNotifications}
          accessibilityLabel={
            unread ? "Notifications, unread" : "Notifications"
          }
          style={{
            backgroundColor: "rgba(255,255,255,0.14)",
            borderColor: "transparent",
          }}
        >
          <BellIcon size={20} color={C.text} />
        </CircleAction>
      </View>

      <View style={{ marginTop: 26 }}>
        <MediaCard
          item={featured}
          width={cardWidth}
          height={Math.round(cardWidth / 2.8)}
          onPress={onPlayFeatured}
        />
      </View>

      <SectionHeader title="Listen To Podcast" style={{ marginTop: 34 }} />

      <View style={{ marginTop: 6 }}>
        <CategoryTabs
          categories={tabs}
          active={tab}
          onChange={setTab}
          bleed={GUTTER}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <EpisodeGrid
          episodes={episodes}
          size={tileSize}
          bleed={GUTTER}
          onOpen={onOpenEpisode}
        />
      </View>

      <SectionHeader title="Top Authors" style={{ marginTop: 32 }} />

      <View style={{ marginTop: 16 }}>
        <AuthorRail authors={authors} bleed={GUTTER} onOpen={onOpenAuthor} />
      </View>
    </Screen>
  );
}
