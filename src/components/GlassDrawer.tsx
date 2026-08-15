import { type GlassStyle } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";

import { C } from "../theme/tokens";
import { Prism } from "./Prism";
import { GlassSurface } from "./ui";

/** Soft falloff above the glass so the seam doesn't end on a hard line. */
const FADE_HEIGHT = 34;

/**
 * Bottom drawer that slides its own height up on mount and carries the screen's
 * actions on a glass ground. It measures itself first, so the entry always
 * starts exactly off-screen no matter how tall the content ends up.
 *
 * The glass is left unscrimmed by default — same translucency as `NavHeader`,
 * so whatever sits behind stays visible through it. `effect` and `tintOpacity`
 * are the two dials on that: blur strength and darkening, tuned independently.
 *
 * This is fixed chrome that animates in and stays. For a sheet the user can
 * dismiss, use `Sheet` — it is built on a gesture library rather than
 * re-implementing drag physics here.
 */
export function GlassDrawer({
  children,
  delay = 0,
  width,
  radius = 26,
  effect,
  tintOpacity,
  prism = 1,
  onHeightChange,
  style,
}: {
  children: React.ReactNode;
  /** Held off-screen this long, so a hero behind it can land first. */
  delay?: number;
  /** Screen width — sizes the prism smear at the top seam. */
  width: number;
  /** Curve on the two top corners; the bottom stays square against the edge. */
  radius?: number;
  /** Blur strength: `clear` barely frosts, `regular` is chrome, `none` is flat. */
  effect?: GlassStyle;
  /** 0–1 darkening over the blur. Omit for the shared chrome value. */
  tintOpacity?: number;
  /** 0–1 on the brand smear at the seam; 0 drops it entirely. */
  prism?: number;
  /** Resting height, fade included — anchor anything sitting above it to this. */
  onHeightChange?: (height: number) => void;
  style?: ViewStyle;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);
  return (
    <Animated.View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        onHeightChange?.(h);
        if (measured) return;
        y.setValue(h);
        setMeasured(true);
        Animated.timing(y, {
          toValue: 0,
          duration: 760,
          delay,
          // Long tail out of a fast start — the drawer arrives and settles
          // rather than bouncing, which a glass slab should never do.
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }).start();
      }}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        opacity: measured ? 1 : 0,
        transform: [{ translateY: y }],
      }}
    >
      {/* Rides above the glass rather than over it, so the blur's top edge
          fades into the mark behind instead of cutting across it. */}
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", C.glassEdge]}
        style={{ height: FADE_HEIGHT }}
      />

      <View
        style={[
          {
            // Clips the glass and the prism to the curve — both layers fill
            // the frame, so the corner is cut once, here.
            overflow: "hidden",
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderTopWidth: 1,
            borderTopColor: C.border,
          },
          style,
        ]}
      >
        {/* The native glass layer draws its own backing and does not always
            honor an ancestor's clip, so it carries the same curve directly. */}
        <GlassSurface
          radius={0}
          bordered={false}
          effect={effect}
          tintOpacity={tintOpacity}
          style={{
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          }}
        />
        {prism > 0 ? <Prism width={width + 128} intensity={prism} /> : null}

        {children}
      </View>
    </Animated.View>
  );
}
