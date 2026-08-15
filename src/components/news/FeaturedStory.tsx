import { View } from "react-native";

import type { FeaturedArticle } from "../../data/news";
import { C, F } from "../../theme/tokens";
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
        size={14.5}
        style={{ fontFamily: F.bodySemibold, lineHeight: 21 }}
        numberOfLines={3}
      >
        {article.title}
      </Body>

      <View style={{ marginTop: 10 }}>
        <ArticleMeta channel={article.channel} age={article.age} />
      </View>

      <View style={{ flexDirection: "row", gap: GAP, marginTop: 12 }}>
        <View
          style={{
            flex: 1,
            height: GALLERY_H,
            borderRadius: RADIUS,
            overflow: "hidden",
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

        <View style={{ flex: 1, gap: GAP }}>
          {rest.slice(0, 2).map((image, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                borderRadius: RADIUS,
                overflow: "hidden",
                backgroundColor: C.raised,
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
