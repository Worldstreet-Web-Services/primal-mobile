import { type ImageSource } from "expo-image";
import { FlatList, Text, View } from "react-native";

import { PressableScale } from "../ui";
import { ArtSlot } from "./ArtSlot";

export interface Space {
  key: string;
  /** Shown under the tile. Kept short — the rail is a glance, not a menu. */
  label: string;
  artwork?: ImageSource | number;
}

/** Tile width. Four sit within the screen padding; the fifth peeks. */
export const SPACE_TILE_WIDTH = 84;

/** One square doorway into a product surface. */
export function SpaceTile({
  space,
  onPress,
  width = SPACE_TILE_WIDTH,
}: {
  space: Space;
  onPress?: (key: string) => void;
  width?: number;
}) {
  return (
    <PressableScale onPress={() => onPress?.(space.key)} scale={0.94}>
      <View
        style={{ width }}
        accessibilityRole="button"
        accessibilityLabel={space.label}
      >
        {/* Free-floating illustration, no card chrome — client call 2026-08:
            the rail is icons on the canvas, not boxed CTAs. */}
        <View className="h-[68px] items-center justify-center">
          <ArtSlot source={space.artwork} size={62} />
        </View>
        <Text
          numberOfLines={1}
          className="font-mono text-[10px] tracking-[0.7px] text-center mt-[9px] text-sub"
        >
          {space.label.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
  );
}

/**
 * Horizontally scrolling ecosystem rail. Sized so four tiles land within the
 * screen padding and anything beyond that scrolls in.
 */
export function SpaceNav({
  spaces,
  onSelect,
  gap = 10,
  contentInset = 0,
}: {
  spaces: Space[];
  onSelect?: (key: string) => void;
  gap?: number;
  /** Extra horizontal padding when the rail should bleed past the screen gutter. */
  contentInset?: number;
}) {
  return (
    <FlatList
      data={spaces}
      horizontal
      keyExtractor={(space) => space.key}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap, paddingHorizontal: contentInset }}
      renderItem={({ item }) => <SpaceTile space={item} onPress={onSelect} />}
    />
  );
}
