import { View } from "react-native";

import type { Article } from "../../data/news";
import { C, F } from "../../theme/tokens";
import { ArtSlot } from "../home";
import { Body, PressableScale } from "../ui";
import { ArticleMeta } from "./ArticleMeta";

/** Carousel card: render on top, headline and byline beneath. */
export function NewsCard({
  article,
  onPress,
  width = 265,
  imageHeight = 145,
}: {
  article: Article;
  onPress?: (key: string) => void;
  width?: number;
  imageHeight?: number;
}) {
  return (
    <PressableScale scale={0.98} onPress={() => onPress?.(article.key)}>
      <View style={{ width }}>
        <View
          style={{
            height: imageHeight,
            borderRadius: 12,
            overflow: "hidden",
            backgroundColor: C.raised,
          }}
        >
          <ArtSlot
            fill
            contentFit="cover"
            size={imageHeight * 0.62}
            source={article.image}
          />
        </View>

        <Body
          size={13.5}
          numberOfLines={2}
          style={{ fontFamily: F.bodySemibold, lineHeight: 19, marginTop: 12 }}
        >
          {article.title}
        </Body>

        <View style={{ marginTop: 8 }}>
          <ArticleMeta channel={article.channel} age={article.age} />
        </View>
      </View>
    </PressableScale>
  );
}
