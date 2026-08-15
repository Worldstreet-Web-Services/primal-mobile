import React, { useMemo } from "react";
import { View, ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { encodeQR } from "../lib/qr";
import { C, F } from "../theme/tokens";
import { Mono } from "./ui";

/**
 * A real, scannable QR on a machined plate.
 *
 * The code itself is drawn dark-on-white, because that is the contrast a phone
 * camera is built for — inverting it to match the dark UI is the single most
 * common way a beautiful deposit screen becomes an unscannable one. The plate
 * is what carries the house style instead: a milled bezel, a hairline seat and
 * four corner ticks, so the white square reads as an inlaid part rather than a
 * hole punched in the page.
 */
export function QrPlate({
  value,
  size = 168,
  caption,
  style,
}: {
  value: string;
  /** Edge length of the white field, in points. */
  size?: number;
  /** Quiet line milled into the bezel under the code. */
  caption?: string;
  style?: ViewStyle;
}) {
  const matrix = useMemo(() => encodeQR(value), [value]);

  // 16:9-ish bezel padding, and a quiet zone inside the white field — the
  // standard asks for four modules of margin and scanners hold us to it.
  const pad = 14;
  const quiet = 2;

  return (
    <View
      style={[
        {
          alignSelf: "center",
          padding: pad,
          borderRadius: 26,
          backgroundColor: C.inset,
          borderWidth: 1,
          borderColor: C.border,
          alignItems: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* Machined top edge — the same shine the kit's Card uses, inset to the
          bezel so it reads as a milled lip. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 22,
          right: 22,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.22)",
        }}
      />
      <CornerTicks inset={7} />

      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        {matrix ? (
          <QrMatrix matrix={matrix} size={size} quiet={quiet} />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
            }}
          >
            <Mono size={10} color="#6A7078" style={{ textAlign: "center" }}>
              CODE UNAVAILABLE
            </Mono>
          </View>
        )}
      </View>

      {caption ? (
        <Mono
          size={9}
          color={C.dim}
          style={{
            marginTop: 10,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            fontFamily: F.mono,
          }}
        >
          {caption}
        </Mono>
      ) : null}
    </View>
  );
}

/**
 * The modules themselves, as one merged path. One path beats one rect per
 * module by roughly 900 nodes on a version-4 symbol, which is the difference
 * between the address step settling instantly and visibly hitching.
 */
function QrMatrix({
  matrix,
  size,
  quiet,
}: {
  matrix: boolean[][];
  size: number;
  quiet: number;
}) {
  const n = matrix.length;
  const span = n + quiet * 2;
  const d = useMemo(() => {
    let out = "";
    for (let r = 0; r < n; r++) {
      let run = 0;
      for (let c = 0; c <= n; c++) {
        const on = c < n && matrix[r][c];
        if (on) {
          run++;
          continue;
        }
        if (run > 0) {
          // Horizontal runs merge into one rect each — fewer nodes, and no
          // hairline seams between neighbouring modules on fractional scales.
          out += `M${c - run + quiet} ${r + quiet}h${run}v1h${-run}z`;
          run = 0;
        }
      }
    }
    return out;
  }, [matrix, n, quiet]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${span} ${span}`}>
      <Rect x={0} y={0} width={span} height={span} fill="#FFFFFF" />
      <Path d={d} fill="#0A0B0D" />
    </Svg>
  );
}

/** Four corner ticks — the machined register marks around the plate. */
function CornerTicks({ inset }: { inset: number }) {
  const arm = 9;
  const color = "rgba(255,255,255,0.16)";
  const bar = (s: ViewStyle) => (
    <View pointerEvents="none" style={[{ position: "absolute" }, s]} />
  );
  return (
    <>
      {bar({ top: inset, left: inset, width: arm, height: 1, backgroundColor: color })}
      {bar({ top: inset, left: inset, width: 1, height: arm, backgroundColor: color })}
      {bar({ top: inset, right: inset, width: arm, height: 1, backgroundColor: color })}
      {bar({ top: inset, right: inset, width: 1, height: arm, backgroundColor: color })}
      {bar({ bottom: inset, left: inset, width: arm, height: 1, backgroundColor: color })}
      {bar({ bottom: inset, left: inset, width: 1, height: arm, backgroundColor: color })}
      {bar({ bottom: inset, right: inset, width: arm, height: 1, backgroundColor: color })}
      {bar({ bottom: inset, right: inset, width: 1, height: arm, backgroundColor: color })}
    </>
  );
}
