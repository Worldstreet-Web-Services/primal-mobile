import React, { useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

import { C, F } from "../../theme/tokens";

export interface Candle {
  /** Open, high, low, close. Numbers — a chart is geometry, not a money label. */
  o: number;
  h: number;
  l: number;
  c: number;
  /** Traded volume for the bar beneath. */
  v?: number;
}

/** Right-hand gutter reserved for the price axis, so candles never run under it. */
const AXIS_W = 54;

const abbreviate = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Candlestick chart with a price axis, a dashed line on the last close, and an
 * optional volume histogram underneath.
 *
 * Down candles are grey rather than red: on this surface red means a losing
 * position, and a red bar inside a winning trade's chart reads as a
 * contradiction. Direction is carried by value, and the P&L below says the
 * rest.
 *
 * The series is numeric — unlike the money strings everywhere else, a chart
 * has to scale its own values. Formatting stays at the edge, in `formatPrice`.
 */
export function CandleChart({
  candles,
  times = [],
  height = 190,
  volumeHeight = 46,
  gridLines = 5,
  formatPrice = abbreviate,
  up = C.up,
  // Down candles are deliberately neutral, not red — the house reads a chart by
  // what rose, and a wall of red competes with that. The value is relit for the
  // charcoal ground (2026-08-16): the old grey cleared near-black by a wide
  // margin and cleared #232323 by almost nothing, which left every down bar
  // dissolving into the plot. Lifted to hold the same separation it used to.
  down = "#565B63",
  highlight = C.highlight,
  showLast = true,
}: {
  candles: Candle[];
  /** X-axis labels, spread evenly across the plot. */
  times?: string[];
  /** The candle panel; the volume row and labels add to this. */
  height?: number;
  /** 0 drops the histogram entirely. */
  volumeHeight?: number;
  gridLines?: number;
  formatPrice?: (value: number) => string;
  up?: string;
  down?: string;
  /** The "now" marker: dashed line plus the tag on the axis. */
  highlight?: string;
  showLast?: boolean;
}) {
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const plotW = Math.max(width - AXIS_W, 0);
  const ready = width > 0 && candles.length > 0;

  // Padded so the extreme wicks don't touch the frame.
  const lo = Math.min(...candles.map((d) => d.l));
  const hi = Math.max(...candles.map((d) => d.h));
  const pad = (hi - lo) * 0.08 || 1;
  const min = lo - pad;
  const span = hi + pad - min || 1;

  const y = (v: number) => (1 - (v - min) / span) * height;
  const slot = plotW / Math.max(candles.length, 1);
  const bodyW = Math.max(slot * 0.55, 1);
  const x = (i: number) => i * slot + slot / 2;

  const last = candles[candles.length - 1];
  const maxVol = Math.max(...candles.map((d) => d.v ?? 0), 1);

  return (
    <View onLayout={onLayout}>
      {ready ? (
        <>
          <Svg width={width} height={height}>
            {/* Gridlines, each labelled on the axis to its right. */}
            {Array.from({ length: gridLines }, (_, i) => {
              const t = i / (gridLines - 1);
              const value = min + span * (1 - t);
              const gy = t * height;
              return (
                <React.Fragment key={i}>
                  <Line
                    x1={0}
                    y1={gy}
                    x2={plotW}
                    y2={gy}
                    stroke={C.hairline}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={width}
                    y={gy + 4}
                    textAnchor="end"
                    fontFamily={F.mono}
                    fontSize={9.5}
                    fill={C.dim}
                  >
                    {formatPrice(value)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {candles.map((d, i) => {
              const rising = d.c >= d.o;
              const color = rising ? up : down;
              const top = y(Math.max(d.o, d.c));
              const bottom = y(Math.min(d.o, d.c));
              return (
                <React.Fragment key={i}>
                  <Line
                    x1={x(i)}
                    y1={y(d.h)}
                    x2={x(i)}
                    y2={y(d.l)}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <Rect
                    x={x(i) - bodyW / 2}
                    y={top}
                    width={bodyW}
                    // Doji candles would collapse to nothing without a floor.
                    height={Math.max(bottom - top, 1)}
                    fill={color}
                    rx={1}
                  />
                </React.Fragment>
              );
            })}

            {showLast ? (
              <>
                <Line
                  x1={0}
                  y1={y(last.c)}
                  x2={plotW}
                  y2={y(last.c)}
                  stroke={highlight}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.8}
                />
                <Rect
                  x={plotW + 2}
                  y={y(last.c) - 9}
                  width={AXIS_W - 4}
                  height={18}
                  rx={4}
                  fill={highlight}
                />
                <SvgText
                  x={plotW + AXIS_W / 2}
                  y={y(last.c) + 4}
                  textAnchor="middle"
                  fontFamily={F.monoSemibold}
                  fontSize={9.5}
                  fill={C.highlightInk}
                >
                  {formatPrice(last.c)}
                </SvgText>
              </>
            ) : null}
          </Svg>

          {times.length ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                width: plotW,
                marginTop: 8,
              }}
            >
              {times.map((t) => (
                <Text
                  key={t}
                  style={{ fontFamily: F.mono, fontSize: 9.5, color: C.dim }}
                >
                  {t}
                </Text>
              ))}
            </View>
          ) : null}

          {volumeHeight > 0 ? (
            <Svg width={width} height={volumeHeight} style={{ marginTop: 10 }}>
              {candles.map((d, i) => {
                const v = d.v ?? 0;
                const h = Math.max((v / maxVol) * volumeHeight, 2);
                return (
                  <Rect
                    key={i}
                    x={x(i) - bodyW / 2}
                    y={volumeHeight - h}
                    width={bodyW}
                    height={h}
                    fill={d.c >= d.o ? up : down}
                    rx={1}
                  />
                );
              })}
            </Svg>
          ) : null}
        </>
      ) : (
        // Holds the block's height while the width is still being measured, so
        // the page doesn't jump on first paint.
        <View style={{ height: height + volumeHeight + 26 }} />
      )}
    </View>
  );
}
