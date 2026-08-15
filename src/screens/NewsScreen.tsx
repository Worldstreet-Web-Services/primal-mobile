import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  CategoryTabs,
  FeaturedStory,
  NewsCard,
  SectionHeader,
  TopicRow,
} from "../components/news";
import { BackChevron, Display, Screen } from "../components/ui";
import {
  categories,
  featured,
  latest,
  recommended,
  type Article,
} from "../data/news";
import { C } from "../theme/tokens";

/** Screen gutter. Rows that run to the edge give it back as negative margin. */
const PAD = 16;

/**
 * Centred title with a circular back button — the editorial header, distinct
 * from the app's `BackHeader` (title beside the chevron), which would read as
 * a settings page here.
 */
function NewsHeader({ onBack }: { onBack?: () => void }) {
  return (
    <View
      style={{
        height: 44,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 6,
      }}
    >
      <Display size={17}>News</Display>

      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{
          position: "absolute",
          left: 0,
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: C.raised,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BackChevron color={C.text} />
      </Pressable>
    </View>
  );
}

/**
 * The News (PRD §5). A lead story over its gallery, a carousel of the latest,
 * and a recommendation shelf — filtered by the category row up top.
 *
 * Filtering is local and client-side for now: the feed arrives whole, so the
 * tabs partition what's already here. It becomes a query param on the day the
 * editorial endpoint lands.
 */
export default function NewsScreen({
  onBack,
  onOpenArticle,
  onViewAll,
  bottom = 40,
}: {
  onBack?: () => void;
  onOpenArticle?: (key: string) => void;
  /** Which shelf's "View All" was tapped. */
  onViewAll?: (section: "latest" | "recommended") => void;
  bottom?: number;
}) {
  const [category, setCategory] = useState(0);

  const open = (key: string) => onOpenArticle?.(key);
  const cardKey = (article: Article) => article.key;

  return (
    <Screen pad={PAD} bottom={bottom}>
      <View style={{ marginTop: 8 }}>
        <CategoryTabs
          categories={categories}
          active={category}
          onChange={setCategory}
          bleed={PAD}
        />
      </View>

      <View style={{ marginTop: 18 }}>
        <FeaturedStory article={featured} onPress={open} />
      </View>

      <SectionHeader
        title="Latest News"
        onAction={() => onViewAll?.("latest")}
        style={{ marginTop: 26 }}
      />

      {/* Runs off the right edge, so it reclaims the gutter and re-applies it
          as content padding — the first card still lines up with the header. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -PAD, marginTop: 14 }}
        contentContainerStyle={{ paddingHorizontal: PAD, gap: 14 }}
      >
        {latest.map((article) => (
          <NewsCard key={cardKey(article)} article={article} onPress={open} />
        ))}
      </ScrollView>

      {/* Raised panel, full-bleed: the shelf reads as the foot of the page. */}
      <View
        style={{
          marginTop: 28,
          marginHorizontal: -PAD,
          paddingHorizontal: PAD,
          paddingTop: 18,
          paddingBottom: 6,
          backgroundColor: C.raised,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
        }}
      >
        <SectionHeader
          title="Recommendation Topic"
          onAction={() => onViewAll?.("recommended")}
        />

        <View style={{ marginTop: 4 }}>
          {recommended.map((article, i) => (
            <TopicRow
              key={cardKey(article)}
              article={article}
              onPress={open}
              divider={i < recommended.length - 1}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
