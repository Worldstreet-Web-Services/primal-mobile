import { View } from "react-native";

import type { Article } from "../../data/news";
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
          className="rounded-[12px] overflow-hidden bg-canvas-raised"
          style={{
            height: imageHeight,
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
          className="text-[13.5px] font-body-semibold leading-[19px] mt-[12px]"

          numberOfLines={2}
        >
          {article.title}
        </Body>

        <View className="mt-[8px]">
          <ArticleMeta channel={article.channel} age={article.age} />
        </View>
      </View>
    </PressableScale>
  );
}
