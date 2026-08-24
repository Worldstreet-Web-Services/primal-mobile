import React from "react";
import { View } from "react-native";

import { C } from "../../theme/tokens";
import { Body, Mono, PressableScale } from "../ui";
import { cn } from "@/lib/cn";

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
        className="flex-row items-center py-[15px] border-b-rule"
        style={{
          borderBottomWidth: last ? 0 : 1,
        }}
      >
        <View className="flex-1">
          <Body className="text-[14px]" semibold>
            {asset.name}
          </Body>
          <View className="flex-row items-center gap-[5px] mt-[4px]">
            {subIcon}
            <Body className="text-[11.5px] text-dim">{asset.sub}</Body>
          </View>
        </View>
        <View className="items-end">
          <Mono className="text-[13.5px]">{asset.value}</Mono>
          <Mono
            size={11.5}

            className={cn("mt-[4px]", asset.down ? "text-down" : "text-up")}
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
