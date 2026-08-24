import { Text, View } from "react-native";

import { C } from "../../theme/tokens";
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
        className="rounded-[18px] bg-canvas-raised border border-rule overflow-hidden justify-end p-[14px]"
        style={{
          height,
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

        <View className="flex-row items-end">
          <View className="flex-1">
            {item.kicker ? (
              <Text className="font-mono text-[8.5px] tracking-[1.4px] text-dim mb-[6px]">
                {item.kicker.toUpperCase()}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              className="font-display text-[38px] tracking-[0.3px] text-text"
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
