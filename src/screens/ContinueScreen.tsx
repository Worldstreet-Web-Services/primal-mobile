import { useEffect, useRef } from "react";
import { Animated, Easing, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingBackdrop } from "../components/FloatingBackdrop";
import { ArrowRight } from "../components/icons";
import { Logo } from "../components/Logo";
import { Display, Mono, PrimaryButton } from "../components/ui";
import { C, F } from "../theme/tokens";

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
  brand = "Paradigm",
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

  const enter = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

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
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
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
        style={[
          {
            position: "absolute",
            top: backdropTop + width * RING_CENTER - markH / 2,
            left: 0,
            right: 0,
            alignItems: "center",
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
        style={[
          { marginTop: backdropTop + width * COPY_TOP, paddingHorizontal: 20 },
          step(1),
        ]}
      >
        <Display size={32} style={{ fontFamily: F.displayBold }}>
          {title.toUpperCase()}
        </Display>
        <Display
          size={32}
          color={C.brand}
          style={{ fontFamily: F.displayBold, marginTop: 2 }}
        >
          {brand.toUpperCase()}
        </Display>

        <Mono size={18} style={{ letterSpacing: 1.6, marginTop: 16 }}>
          {`${tagline.toUpperCase()} `}
          <Mono size={18} color={C.brand} style={{ letterSpacing: 1.6 }}>
            {taglineAccent.toUpperCase()}
          </Mono>
        </Mono>
      </Animated.View>

      <Animated.View
        style={[
          {
            marginTop: "auto",
            paddingHorizontal: 20,
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
