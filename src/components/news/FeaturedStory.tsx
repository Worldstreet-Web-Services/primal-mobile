import { View } from "react-native";

import type { FeaturedArticle } from "../../data/news";
import { C } from "../../theme/tokens";
import { ArtSlot } from "../home";
import { Body, PressableScale } from "../ui";
import { ArticleMeta } from "./ArticleMeta";

/** Height of the whole gallery; the lead render takes all of it. */
const GALLERY_H = 214;
const GAP = 9;
const RADIUS = 12;

/**
 * The lead story: headline, byline, then a three-up gallery — one tall render
 * beside two stacked ones. The split is fixed rather than driven by the image
 * count, because the shape is the composition; a missing render leaves its
 * placeholder in place instead of collapsing the grid.
 */
export function FeaturedStory({
  article,
  onPress,
}: {
  article: FeaturedArticle;
  onPress?: (key: string) => void;
}) {
  const [lead, ...rest] = article.gallery;

  return (
    <PressableScale scale={0.99} onPress={() => onPress?.(article.key)}>
      <Body
        className="text-[14.5px] font-body-semibold leading-[21px]"

        numberOfLines={3}
      >
        {article.title}
      </Body>

      <View className="mt-[10px]">
        <ArticleMeta channel={article.channel} age={article.age} />
      </View>

      <View className="flex-row mt-[12px]" style={{ gap: GAP }}>
        <View
          className="flex-1 overflow-hidden"
          style={{
            height: GALLERY_H,
            borderRadius: RADIUS,
            // Ground under the art, so an empty well still reads as a frame
            // rather than a placeholder floating on the canvas.
            backgroundColor: C.raised,
          }}
        >
          <ArtSlot
            fill
            contentFit="cover"
            size={GALLERY_H * 0.7}
            source={lead}
          />
        </View>

        <View className="flex-1" style={{ gap: GAP }}>
          {rest.slice(0, 2).map((image, i) => (
            <View
              key={i}
              className="flex-1 overflow-hidden bg-canvas-raised"
              style={{
                borderRadius: RADIUS,
              }}
            >
              <ArtSlot
                fill
                contentFit="cover"
                size={GALLERY_H * 0.34}
                source={image}
              />
            </View>
          ))}
        </View>
      </View>
    </PressableScale>
  );
}
