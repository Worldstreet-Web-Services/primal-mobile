import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View } from "react-native";

import { C } from "../theme/tokens";
import { Logo } from "./Logo";

/** How far each line travels on its way in. */
const RISE = 22;
const DURATION = 520;
/** Gap between the mark landing and the wordmark following it. */
const STAGGER = 150;

/**
 * Brand splash: the mark over the wordmark on the canvas.
 *
 * `animated` stages them in — the mark rises first, the wordmark follows a beat
 * later. Left off, both are simply present, which is what you want for a
 * screenshot, a test, or a re-entry where a replayed animation would nag.
 *
 * `onDone` fires once the sequence (plus `hold`) has finished, so a route can
 * hand off without guessing at the duration. It fires on the next tick in the
 * static case, so callers get the same contract either way.
 */
export function Splash({
  animated = true,
  markSize = 96,
  wordmark = "KashPlus",
  hold = 420,
  onDone,
}: {
  animated?: boolean;
  markSize?: number;
  wordmark?: string;
  /** Beat to sit on the finished mark before `onDone`, in ms. */
  hold?: number;
  onDone?: () => void;
}) {
  // One driver per line so they can be offset; 0 = hidden and low, 1 = landed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mark = useMemo(() => new Animated.Value(animated ? 0 : 1), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const word = useMemo(() => new Animated.Value(animated ? 0 : 1), []);

  // `onDone` is read through a ref so a caller passing an inline arrow doesn't
  // restart the animation on every render.
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const rise = (value: Animated.Value, delay: number) =>
      Animated.timing(value, {
        toValue: 1,
        duration: DURATION,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    if (!animated) {
      const t = setTimeout(() => done.current?.(), 0);
      return () => clearTimeout(t);
    }

    const sequence = Animated.parallel([rise(mark, 0), rise(word, STAGGER)]);
    sequence.start(({ finished }) => {
      if (finished) setTimeout(() => done.current?.(), hold);
    });
    return () => sequence.stop();
  }, [animated, hold, mark, word]);

  const lift = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [RISE, 0],
        }),
      },
    ],
  });

  return (
    <View className="flex-1 bg-canvas items-center justify-center">
      <Animated.View style={lift(mark)}>
        <Logo height={markSize} accessibilityLabel={wordmark} />
      </Animated.View>

      <Animated.Text
        className="font-display text-[38px] tracking-[-0.5px] mt-[12px]"
        style={[
          {
            // Plain white. The gold lives in the mark directly above it, and a
            // coloured wordmark under a coloured mark makes two accents fight
            // over one lockup.
            color: C.text,
          },
          lift(word),
        ]}
      >
        {wordmark}
      </Animated.Text>
    </View>
  );
}
