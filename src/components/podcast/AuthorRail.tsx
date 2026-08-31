import { type ImageSource } from "expo-image";
import { ScrollView } from "react-native";

import { Avatar } from "../home";
import { PressableScale } from "../ui";

export interface Author {
  key: string;
  name: string;
  artwork?: ImageSource | number;
  /** Ring color — lights one host up as the featured voice. */
  /** Ring colour, as a border class — data cannot hold a themed value. */
  accentClassName?: string;
}

/**
 * Row of hosts, portraits only. No names underneath: at this size the faces
 * are the label, and a caption row would halve how many fit the screen.
 */
export function AuthorRail({
  authors,
  onOpen,
  size = 85,
  gap = 25,
  bleed = 0,
}: {
  authors: Author[];
  onOpen?: (key: string) => void;
  size?: number;
  gap?: number;
  /** The page gutter, so the rail can run edge to edge. */
  bleed?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={{ paddingHorizontal: bleed, gap }}
    >
      {authors.map((author) => (
        <PressableScale
          key={author.key}
          scale={0.95}
          onPress={() => onOpen?.(author.key)}
          accessibilityLabel={author.name}
        >
          <Avatar
            source={author.artwork}
            initial={author.name}
            size={size}
            ringClassName={author.accentClassName ?? "border-rule"}
          />
        </PressableScale>
      ))}
    </ScrollView>
  );
}
