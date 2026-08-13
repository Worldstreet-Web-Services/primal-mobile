import { useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { C } from "../../theme/tokens";

/**
 * Price history as a filled line. Deliberately axis-free — it reads as shape
 * and direction; the exact numbers live in the header above it.
 */
export function AreaChart({
  data,
  height = 130,
  color = C.up,
  strokeWidth = 2,
}: {
  /** Series in chronological order. Two points minimum. */
  data: number[];
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  // Inset the stroke so its round cap isn't clipped at the edges.
  const pad = strokeWidth;
  const usable = height - pad * 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;

  const x = (i: number) => (i / Math.max(data.length - 1, 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * usable;

  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <View onLayout={onLayout} style={{ height }}>
      {width > 0 && data.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#areaFill)" />
          <Path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : null}
    </View>
  );
}
