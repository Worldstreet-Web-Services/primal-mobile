import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { ArrowRight } from "../icons";
import { PressableScale, Shine } from "../ui";
import { ArtSlot } from "./ArtSlot";
import type { MediaItem } from "./MediaCard";

/**
 * Full-width editorial row (podcast, news). Title sits on the baseline with
 * the arrow opposite it, so a stack of these reads as one rhythm.
 */
export function MediaRow({
  item,
  onPress,
  height = 140,
}: {
  item: MediaItem;
  onPress?: (key: string) => void;
  height?: number;
}) {
  return (
    <PressableScale onPress={() => onPress?.(item.key)} scale={0.985}>
      <View
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={{
          height,
          borderRadius: 18,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          overflow: "hidden",
          justifyContent: "flex-end",
          padding: 14,
        }}
      >
        <Shine />
        {item.artwork ? (
          <ArtSlot
            source={item.artwork}
            size={height * 1.6}
            style={{ position: "absolute", right: -45, top: height * 0.06 }}
          />
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}>
            {item.kicker ? (
              <Text
                style={{
                  fontFamily: F.mono,
                  fontSize: 8.5,
                  letterSpacing: 1.4,
                  color: C.dim,
                  marginBottom: 6,
                }}
              >
                {item.kicker.toUpperCase()}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                fontFamily: F.display,
                fontSize: 38,
                letterSpacing: 0.3,
                color: C.text,
              }}
            >
              {item.title.toUpperCase()}
            </Text>
          </View>
          <ArrowRight size={38} color={C.text} />
        </View>
      </View>
    </PressableScale>
  );
}

/** Stack of media rows with the section's own spacing. */
export function MediaStack({
  items,
  onOpen,
  gap = 14,
}: {
  items: MediaItem[];
  onOpen?: (key: string) => void;
  gap?: number;
}) {
  return (
    <View style={{ gap }}>
      {items.map((item) => (
        <MediaRow key={item.key} item={item} onPress={onOpen} />
      ))}
    </View>
  );
}
