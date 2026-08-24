import { useEffect, useMemo } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingBackdrop } from "../components/FloatingBackdrop";
import { ArrowRight } from "../components/icons";
import { Logo } from "../components/Logo";
import { Display, Mono, PrimaryButton } from "../components/ui";
import { C } from "../theme/tokens";

/**
 * Where the backdrop's orbit rings converge, as a fraction of screen width.
 * The artwork scales off width, so the eye of the rings tracks width too —
 * anchoring the mark to it keeps them concentric on every screen size.
 */
const RING_CENTER = 0.61;

/**
 * Where the copy starts, as a fraction of screen width below the backdrop's
 * top. Width again, not height — it has to clear the outer orbit ring, and the
 * rings scale with the artwork.
 */
const COPY_TOP = 1.3;

/** One full breath of the drift, in ms. Slow enough to read as ambient. */
const DRIFT = 3800;
/** How far the backdrop travels on that breath, in points. */
const DRIFT_RANGE = 7;

/**
 * The hand-off beat: the mark alone in the drifting metrics, and one way
 * forward. No copy — whatever it continues *into* does the explaining.
 *
 * The mark rises into the rings, the CTA follows a beat later, and the metric
 * pills breathe underneath the whole time.
 */
export default function ContinueScreen({
  title = "Welcome to",
  brand = "KashPlus",
  tagline = "Unlock your",
  taglineAccent = "financial edge",
  label = "Continue",
  onContinue,
}: {
  /** First headline line, in white. */
  title?: string;
  /** Second headline line, carried in the brand color. */
  brand?: string;
  /** Lead-in of the strapline. */
  tagline?: string;
  /** Its closing phrase, which the brand color picks up. */
  taglineAccent?: string;
  label?: string;
  onContinue?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const markW = Math.min(width * 0.42, 180);
  // Mirrors Logo's own ratio maths so the mark can be centred on the rings.
  const markH = markW / (1007 / 1320);
  // The pills are drawn along the artwork's top edge, so it starts below the
  // status bar — otherwise the clock and the notch eat their labels.
  const backdropTop = insets.top + 8;

  const enter = useMemo(() => new Animated.Value(0), []);
  const drift = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 900,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();

    const breath = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: DRIFT,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: DRIFT,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breath.start();
    return () => breath.stop();
  }, [enter, drift]);

  /** Rise-and-fade for the nth beat down the screen. */
  const step = (i: number) => {
    const start = i * 0.22;
    const range = [start, Math.min(start + 0.6, 1)];
    return {
      opacity: enter.interpolate({
        inputRange: range,
        outputRange: [0, 1],
        extrapolate: "clamp" as const,
      }),
      transform: [
        {
          translateY: enter.interpolate({
            inputRange: range,
            outputRange: [18, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  return (
    <View className="flex-1 bg-canvas">
      {/* Pills and rings drift as one plate — they're a single artwork, and
          parallaxing the mark against them is what sells the depth. */}
      <Animated.View
        pointerEvents="none"
        style={{
          transform: [
            {
              translateY: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [-DRIFT_RANGE, DRIFT_RANGE],
              }),
            },
          ],
        }}
      >
        <FloatingBackdrop top={backdropTop} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        className="absolute left-[0px] right-[0px] items-center"
        style={[
          {
            top: backdropTop + width * RING_CENTER - markH / 2,
          },
          {
            opacity: enter,
            transform: [
              {
                scale: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.06, 1],
                }),
              },
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [DRIFT_RANGE * 0.4, -DRIFT_RANGE * 0.4],
                }),
              },
            ],
          },
        ]}
      >
        <Logo width={markW} />
      </Animated.View>

      {/* Set in caps here rather than in the strings, so the copy stays
          readable as prose for whoever edits it next. */}
      <Animated.View
        className="px-[20px]"
        style={[{ marginTop: backdropTop + width * COPY_TOP }, step(1)]}
      >
        <Display className="text-[32px] leading-[33.6px] font-display-bold">
          {title.toUpperCase()}
        </Display>
        <Display className="text-[32px] leading-[33.6px] text-brand font-display-bold mt-[2px]">
          {brand.toUpperCase()}
        </Display>

        <Mono className="text-[18px] tracking-[1.6px] mt-[16px]">
          {`${tagline.toUpperCase()} `}
          <Mono className="text-[18px] text-brand tracking-[1.6px]">
            {taglineAccent.toUpperCase()}
          </Mono>
        </Mono>
      </Animated.View>

      <Animated.View
        className="px-[20px]"
        style={[
          {
            marginTop: "auto",
            paddingBottom: Math.max(insets.bottom, 16) + 8,
          },
          step(2),
        ]}
      >
        <PrimaryButton
          label={label}
          uppercase={false}
          height={58}
          onPress={onContinue}
          trailing={<ArrowRight size={22} color={C.brandSoftInk} />}
        />
      </Animated.View>
    </View>
  );
}
