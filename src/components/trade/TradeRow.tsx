import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { Body, Mono, PressableScale } from "../ui";

export type TradeSide = "long" | "short";

export interface Position {
  id: string;
  /** Market symbol, e.g. "BTC/USDT". */
  pair: string;
  side: TradeSide;
  /** Preformatted strings — the engine speaks decimals, the UI never rounds. */
  changePct: string;
  changeUsd: string;
  trader: string;
  entry: string;
  /** Already mirroring this leader's position. */
  copying?: boolean;
}

/**
 * One leader position: the market and its move on top, who is running it and
 * the copy action underneath.
 */
export function TradeRow({
  position,
  onCopy,
  last,
}: {
  position: Position;
  onCopy?: (id: string) => void;
  last?: boolean;
}) {
  const up = position.side === "long";

  return (
    <View
      style={{
        paddingVertical: 16,
        gap: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Body size={14} semibold>
            {position.pair}
          </Body>
          <Text
            style={{
              fontFamily: F.body,
              fontSize: 11.5,
              marginTop: 3,
              color: up ? C.up : C.down,
            }}
          >
            {up ? "Long" : "Short"}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Mono size={13.5} color={C.up}>
            {position.changePct}
          </Mono>
          <Mono size={11.5} color={C.sub} style={{ marginTop: 3 }}>
            {position.changeUsd}
          </Mono>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Body size={13.5}>{position.trader}</Body>
          <Body size={11} color={C.dim} style={{ marginTop: 3 }}>
            {`Entry ${position.entry}`}
          </Body>
        </View>
        <PressableScale onPress={() => onCopy?.(position.id)} scale={0.95}>
          <View
            accessibilityRole="button"
            accessibilityLabel={`Copy ${position.trader} on ${position.pair}`}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: position.copying ? C.card : C.leaf,
              borderWidth: position.copying ? 1 : 0,
              borderColor: C.leaf,
            }}
          >
            <Text
              style={{
                fontFamily: F.bodySemibold,
                fontSize: 13,
                color: position.copying ? C.leaf : C.leafInk,
              }}
            >
              {position.copying ? "Copying" : "Copy Trade"}
            </Text>
          </View>
        </PressableScale>
      </View>
    </View>
  );
}

/** Positions grouped into one card, hairline-separated. */
export function TradeList({
  positions,
  onCopy,
}: {
  positions: Position[];
  onCopy?: (id: string) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: C.raised,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.hairline,
        paddingHorizontal: 16,
      }}
    >
      {positions.map((position, i) => (
        <TradeRow
          key={position.id}
          position={position}
          onCopy={onCopy}
          last={i === positions.length - 1}
        />
      ))}
    </View>
  );
}
