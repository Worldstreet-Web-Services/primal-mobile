import { Text, View } from "react-native";

import { C } from "../../theme/tokens";
import { PressableScale } from "../ui";
import { ArtSlot } from "./ArtSlot";
import type { Feature } from "./FeatureCard";

/**
 * How real the thing behind a tile is.
 *
 * The grid is a set of doorways, and a doorway that opens onto nothing has to
 * say so on the door. `live` is the only value that claims a working feature;
 * the route table in `src/app/home.tsx` is what decides which tiles get it.
 */
export type FeatureStatus =
  /** Routed, and backed by the gateway or the chain. */
  | "live"
  /** Routed, but the surface behind it has no backend — ARK/WorldStreet. */
  | "preview"
  /** No destination exists yet. The tile does not respond to a tap. */
  | "soon";

export interface FeatureTileItem extends Feature {
  status: FeatureStatus;
}

/** Corner marker for anything that is not `live`. Absent on live tiles. */
function StatusChip({ status }: { status: Exclude<FeatureStatus, "live"> }) {
  return (
    <View className="absolute top-[7px] right-[7px] px-[6px] py-[2.5px] rounded-[6px] bg-canvas-inset">
      {/* 9pt is the floor `dim` was re-derived against — 4.67:1 on `inset`. */}
      <Text className="font-mono text-[9px] tracking-[1.1px] text-dim">
        {status === "preview" ? "PREVIEW" : "SOON"}
      </Text>
    </View>
  );
}

/**
 * A compact doorway: the 3D render centred in a rounded square, the name under
 * it. It fills whatever width its parent gives it and squares itself off.
 *
 * It carries no figure and never will — a tile that quoted a balance would be a
 * second place for an invented number to live.
 */
export function FeatureTile({
  item,
  onPress,
  artSize = 38,
}: {
  item: FeatureTileItem;
  onPress?: (key: string) => void;
  artSize?: number;
}) {
  const dead = item.status === "soon";

  const body = (
    <View
      className="rounded-[18px] bg-canvas-raised border border-rule items-center justify-center px-[8px] gap-[10px] overflow-hidden"
      style={{
        // Slightly wider than tall, per the reference. A square tile at three
        // columns leaves a hole between the artwork and the label; this crops
        // that hole out without shrinking either.
        aspectRatio: 1.16,
        // A doorway that does not open reads as recessed rather than as broken.
        opacity: dead ? 0.55 : 1,
      }}
    >
      {/* The artwork sits in a round well rather than free on the tile face.
          These renders are lit glass objects photographed on nothing, so on a
          flat panel they read as stickers; the well is the light they stand
          in, and it is what makes six of them read as one set. */}
      <View
        className="bg-canvas-inset items-center justify-center"
        style={{
          width: artSize + 16,
          height: artSize + 16,
          borderRadius: (artSize + 16) / 2,
        }}
      >
        <ArtSlot source={item.artwork} size={artSize} tint={C.green} />
      </View>
      <Text
        numberOfLines={2}
        className="font-body-semibold text-[13px] leading-[16px] tracking-[0.1px] text-text text-center"
      >
        {item.title}
      </Text>
      {item.status === "live" ? null : <StatusChip status={item.status} />}
    </View>
  );

  if (dead) {
    // Not a Pressable at all: a disabled button that still dips under a finger
    // is a promise, and there is nothing behind this one to deliver on it.
    return (
      <View accessible accessibilityLabel={`${item.title}, not available yet`}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      onPress={() => onPress?.(item.key)}
      scale={0.96}
      accessibilityLabel={
        item.status === "preview" ? `${item.title}, preview` : item.title
      }
    >
      {body}
    </PressableScale>
  );
}

/**
 * The doorway grid: fixed columns, reflowing for any number of tiles.
 *
 * Columns are percentage widths with the gutter carried as padding inside each
 * cell, so nothing has to be measured and there is no first-frame reflow. A
 * short last row keeps the column width rather than stretching to fill — five
 * tiles in three columns read as 3 + 2 on one grid, not as 3 over 2 fatter
 * ones. The negative outer margin cancels the cells' edge padding, so the
 * tiles' visual edges land on the page gutter.
 *
 * Nothing here knows how many features there are, or which ones.
 */
export function FeatureTileGrid({
  items,
  onOpen,
  columns = 3,
  gap = 11,
  artSize = 38,
}: {
  items: FeatureTileItem[];
  onOpen?: (key: string) => void;
  columns?: number;
  gap?: number;
  artSize?: number;
}) {
  const cols = Math.max(1, columns);
  const half = gap / 2;

  return (
    <View
      className="flex-row flex-wrap"
      style={{
        marginHorizontal: -half,
        marginVertical: -half,
      }}
    >
      {items.map((item) => (
        <View key={item.key} style={{ width: `${100 / cols}%`, padding: half }}>
          <FeatureTile item={item} onPress={onOpen} artSize={artSize} />
        </View>
      ))}
    </View>
  );
}
