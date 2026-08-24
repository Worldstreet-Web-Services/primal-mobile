import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { TrendDownIcon, TrendUpIcon } from "../icons";
import { Body, Mono, PILL, PressableScale } from "../ui";

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
  /** How long the position has been open, e.g. "3h 24m". */
  duration?: string;
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
        // Padding lives on the row, not the list, so the separator below it
        // runs the card's full width instead of stopping short at the gutter.
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Body className="text-[14px]" semibold>
            {position.pair}
          </Body>
          {/* Side and age on one line: the arrow carries the direction, so the
              word beside it can stay small. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 4,
            }}
          >
            {up ? (
              <TrendUpIcon size={12} color={C.up} />
            ) : (
              <TrendDownIcon size={12} color={C.down} />
            )}
            <Text
              style={{
                fontFamily: F.body,
                fontSize: 11.5,
                color: up ? C.up : C.down,
              }}
            >
              {up ? "Long" : "Short"}
            </Text>
            {position.duration ? (
              <Body className="text-[11.5px] text-dim">
                {position.duration}
              </Body>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Mono className="text-[13.5px] text-up">{position.changePct}</Mono>
          <Mono className="text-[11.5px] text-sub" style={{ marginTop: 3 }}>
            {position.changeUsd}
          </Mono>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Body className="text-[13.5px]">{position.trader}</Body>
          <Body className="text-[11px] text-dim" style={{ marginTop: 3 }}>
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
              borderRadius: PILL,
              backgroundColor: position.copying ? C.card : C.brandSoft,
              borderWidth: position.copying ? 1 : 0,
              borderColor: C.brandSoft,
            }}
          >
            <Text
              style={{
                fontFamily: F.bodySemibold,
                fontSize: 13,
                color: position.copying ? C.brandSoft : C.brandSoftInk,
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
        overflow: "hidden",
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
