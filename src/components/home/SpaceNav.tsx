import { type ImageSource } from "expo-image";
import { FlatList, Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
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
        <View
          style={{
            height: 68,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: space.artwork ? C.canvas : C.raised,
            borderWidth: 1,
            borderColor: C.hairline,
          }}
        >
          {space.artwork ? <ArtSlot source={space.artwork} size={52} /> : null}
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 0.7,
            textAlign: "center",
            marginTop: 9,
            color: C.sub,
          }}
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
