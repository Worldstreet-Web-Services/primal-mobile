import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
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
    <View
      style={{
        position: "absolute",
        top: 7,
        right: 7,
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 6,
        backgroundColor: C.inset,
      }}
    >
      {/* 9pt is the floor `dim` was re-derived against — 4.67:1 on `inset`. */}
      <Text style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: 1.1, color: C.dim }}>
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
  artSize = 44,
}: {
  item: FeatureTileItem;
  onPress?: (key: string) => void;
  artSize?: number;
}) {
  const dead = item.status === "soon";

  const body = (
    <View
      style={{
        aspectRatio: 1,
        borderRadius: 18,
        backgroundColor: C.raised,
        borderWidth: 1,
        borderColor: C.hairline,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        gap: 8,
        overflow: "hidden",
        // A doorway that does not open reads as recessed rather than as broken.
        opacity: dead ? 0.55 : 1,
      }}
    >
      <ArtSlot source={item.artwork} size={artSize} tint={C.brandSoft} />
      <Text
        numberOfLines={2}
        style={{
          fontFamily: F.bodySemibold,
          fontSize: 12.5,
          lineHeight: 15,
          letterSpacing: 0.1,
          color: C.text,
          textAlign: "center",
        }}
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
      accessibilityLabel={item.status === "preview" ? `${item.title}, preview` : item.title}
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
  artSize = 44,
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
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
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
