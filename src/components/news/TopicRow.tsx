import { View } from "react-native";

import type { Article } from "../../data/news";
import { C, F } from "../../theme/tokens";
import { ArtSlot } from "../home";
import { Body, PressableScale } from "../ui";
import { ArticleMeta } from "./ArticleMeta";

const THUMB = { width: 92, height: 68 };

/**
 * List row for the recommendation shelf: headline on the left, thumbnail on
 * the right. The reverse of `NewsCard` — the text leads here, because these
 * are scanned in a column rather than glanced at in a carousel.
 */
export function TopicRow({
  article,
  onPress,
  divider = true,
}: {
  article: Article;
  onPress?: (key: string) => void;
  /** Off for the last row, so the list doesn't end on a rule. */
  divider?: boolean;
}) {
  return (
    <PressableScale scale={0.99} onPress={() => onPress?.(article.key)}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 14,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: C.hairline,
        }}
      >
        <View style={{ flex: 1 }}>
          <Body
            size={13.5}
            numberOfLines={2}
            style={{ fontFamily: F.bodySemibold, lineHeight: 19 }}
          >
            {article.title}
          </Body>
          <View style={{ marginTop: 8 }}>
            <ArticleMeta channel={article.channel} age={article.age} />
          </View>
        </View>

        <View
          style={{
            ...THUMB,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: C.inset,
          }}
        >
          <ArtSlot
            fill
            contentFit="cover"
            size={THUMB.height * 0.7}
            source={article.image}
          />
        </View>
      </View>
    </PressableScale>
  );
}
