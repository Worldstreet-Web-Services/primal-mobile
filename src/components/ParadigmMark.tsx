import { useEffect, useRef } from "react";
import { Animated, Easing, View, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";

/**
 * The Paradigm mark, as geometry rather than artwork.
 *
 * Three bars, tallest to shortest, drawn from the supplied 31x44 source. Being
 * vector rather than a PNG is what lets it be tinted to any ground, scaled to a
 * favicon or a splash without a second export, and — the reason it exists in
 * this form — animated a path at a time.
 */

/** The source viewBox. Everything scales off this, so the mark never distorts. */
const VB_W = 31;
const VB_H = 44;

/** Tallest bar first: the stagger reads left to right, so order matters here. */
const BARS = [
  "M0 36.6548V1.01015C0 0.576473 0.481855 0.316442 0.844355 0.554502L7.94003 5.21435C9.01888 5.92285 9.66861 7.12684 9.66861 8.41753V35.4976C9.66861 36.8667 8.9382 38.1318 7.75252 38.8164L5.74825 39.9735C3.19347 41.4485 0 39.6048 0 36.6548Z",
  "M12.4102 30.1611V8.65859C12.4102 8.22491 12.892 7.96488 13.2545 8.20294L20.3502 12.8628C21.429 13.5713 22.0788 14.7753 22.0788 16.066V29.0039C22.0788 30.373 21.3484 31.6381 20.1627 32.3226L18.1584 33.4798C15.6036 34.9548 12.4102 33.1111 12.4102 30.1611Z",
  "M25.6647 15.701C25.3022 15.4629 24.8203 15.723 24.8203 16.1566V24.518C24.8203 26.8565 27.3519 28.3181 29.3771 27.1488C30.317 26.6062 30.896 25.6033 30.896 24.518V20.7759C30.896 19.7527 30.381 18.7983 29.5257 18.2366L25.6647 15.701Z",
];

const AnimatedG = Animated.createAnimatedComponent(G);

/** Resolve one given dimension into both, keeping the source ratio. */
function box(width?: number, height?: number) {
  if (width && height) return { width, height };
  if (width) return { width, height: (width * VB_H) / VB_W };
  const h = height ?? 44;
  return { width: (h * VB_W) / VB_H, height: h };
}

/**
 * The static mark. Size it by `width` OR `height` — the other follows the
 * artwork's ratio, so it can never be stretched by setting only one.
 */
export function ParadigmMark({
  width,
  height,
  color = "#FFFFFF",
  style,
}: {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const size = box(width, height);
  return (
    <View style={style}>
      <Svg {...size} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {BARS.map((d) => (
          <Path key={d} d={d} fill={color} />
        ))}
      </Svg>
    </View>
  );
}

/** How far a bar starts above its resting place, in viewBox units. */
const DROP = 9;
/** Gap between one bar starting and the next. */
const STAGGER = 130;
const FALL = 460;
/** Held at rest before the cycle restarts, so it reads as a beat, not a stutter. */
const HOLD = 620;

/**
 * The mark as a loading state: each bar falls into place in turn, then the whole
 * thing holds and repeats.
 *
 * Driven on the JS thread deliberately. `translateY` on an SVG `<G>` is a real
 * SVG attribute rather than a style transform, so the native driver cannot carry
 * it — and three interpolated values is well inside what JS handles at 60fps.
 * The alternative (three absolutely-positioned SVGs moved by RN transforms) buys
 * the native driver at the cost of the bars no longer sharing one coordinate
 * space, which is how a logo drifts out of alignment.
 */
export function ParadigmLoader({
  width,
  height = 44,
  color = "#FFFFFF",
  style,
}: {
  width?: number;
  height?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const size = box(width, height);
  // One driver per bar: they share a timeline but not a phase.
  const bars = useRef(BARS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const cycle = Animated.sequence([
      Animated.stagger(
        STAGGER,
        bars.map((bar) =>
          Animated.timing(bar, {
            toValue: 1,
            duration: FALL,
            // Overshoot-free settle: it lands and stays landed, which is what
            // separates a loader from a bounce.
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: false,
          }),
        ),
      ),
      Animated.delay(HOLD),
      // Reset instantly and out of sight — the fade-out is the opacity ramp,
      // so there is nothing to see between cycles.
      Animated.parallel(
        bars.map((bar) =>
          Animated.timing(bar, {
            toValue: 0,
            duration: 260,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: false,
          }),
        ),
      ),
    ]);

    const loop = Animated.loop(cycle);
    loop.start();
    return () => loop.stop();
  }, [bars]);

  return (
    <View style={style}>
      <Svg {...size} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {BARS.map((d, i) => (
          <AnimatedG
            key={d}
            opacity={bars[i]}
            translateY={bars[i].interpolate({
              inputRange: [0, 1],
              outputRange: [-DROP, 0],
            })}
          >
            <Path d={d} fill={color} />
          </AnimatedG>
        ))}
      </Svg>
    </View>
  );
}
