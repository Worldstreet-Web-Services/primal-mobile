import React from "react";
import { View } from "react-native";

import { C } from "../../theme/tokens";
import { Body, Mono, PressableScale } from "../ui";

export interface Asset {
  key: string;
  name: string;
  /** Secondary line — ticker, or how long it has been held. */
  sub: string;
  value: string;
  delta: string;
  down?: boolean;
}

/**
 * Holding line: what it is on the left, what it's worth on the right. Used for
 * both the watch list and the portfolio, which differ only by their sub line.
 */
export function AssetRow({
  asset,
  subIcon,
  onPress,
  last,
}: {
  asset: Asset;
  /** Glyph rendered before the sub line — a clock on held positions. */
  subIcon?: React.ReactNode;
  onPress?: (key: string) => void;
  last?: boolean;
}) {
  return (
    <PressableScale onPress={() => onPress?.(asset.key)} scale={0.99}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 15,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: C.hairline,
        }}
      >
        <View style={{ flex: 1 }}>
          <Body size={14} semibold>
            {asset.name}
          </Body>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              marginTop: 4,
            }}
          >
            {subIcon}
            <Body size={11.5} color={C.dim}>
              {asset.sub}
            </Body>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Mono size={13.5}>{asset.value}</Mono>
          <Mono
            size={11.5}
            color={asset.down ? C.down : C.up}
            style={{ marginTop: 4 }}
          >
            {asset.delta}
          </Mono>
        </View>
      </View>
    </PressableScale>
  );
}

/** Asset rows sharing one card. */
export function AssetList({
  assets,
  subIcon,
  onOpen,
  framed = true,
}: {
  assets: Asset[];
  subIcon?: React.ReactNode;
  onOpen?: (key: string) => void;
  /** Off for a bare list on the canvas. */
  framed?: boolean;
}) {
  return (
    <View
      style={
        framed
          ? {
              backgroundColor: C.raised,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: C.hairline,
              paddingHorizontal: 16,
            }
          : undefined
      }
    >
      {assets.map((asset, i) => (
        <AssetRow
          key={asset.key}
          asset={asset}
          subIcon={subIcon}
          onPress={onOpen}
          last={i === assets.length - 1}
        />
      ))}
    </View>
  );
}
