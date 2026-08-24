import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Screen } from "@/components/ui";
import {
  categories,
  featured,
  latest,
  recommended,
  type Article,
} from "@/data/news";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CategoryTabs,
  FeaturedStory,
  NewsCard,
  SectionHeader,
  TopicRow,
} from "../components/news";

/** Screen gutter. Rows that run to the edge give it back as negative margin. */
const PAD = 16;

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
}: {
  onBack?: () => void;
  onOpenArticle?: (key: string) => void;
  /** Which shelf's "View All" was tapped. */
  onViewAll?: (section: "latest" | "recommended") => void;
}) {
  const inset = useSafeAreaInsets();
  const [category, setCategory] = useState(0);

  const open = (key: string) => onOpenArticle?.(key);
  const cardKey = (article: Article) => article.key;

  return (
    <Screen pad={PAD} bottom={inset.bottom}>
      <View className="mt-[8px]">
        <CategoryTabs
          categories={categories}
          active={category}
          onChange={setCategory}
          bleed={PAD}
        />
      </View>

      <View className="mt-[18px]">
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
        className="mt-[14px]"
        style={{ marginHorizontal: -PAD }}
        contentContainerStyle={{ paddingHorizontal: PAD, gap: 14 }}
      >
        {latest.map((article) => (
          <NewsCard key={cardKey(article)} article={article} onPress={open} />
        ))}
      </ScrollView>

      {/* Raised panel, full-bleed: the shelf reads as the foot of the page. */}
      <View
        className="mt-[28px] pt-[18px] pb-[6px] bg-canvas-raised"
        style={{
          marginHorizontal: -PAD,
          paddingHorizontal: PAD,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
        }}
      >
        <SectionHeader
          title="Recommendation Topic"
          onAction={() => onViewAll?.("recommended")}
        />

        <View className="mt-[4px]">
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
