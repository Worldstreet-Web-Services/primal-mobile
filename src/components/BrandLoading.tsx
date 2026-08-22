import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { C, F } from "../theme/tokens";
import { ParadigmLoader } from "./ParadigmMark";

const CROWN = require("@/assets/images/crown.png");
/** The artwork's own ratio (563x418) — width drives, height follows. */
const CROWN_ASPECT = 563 / 418;

/** Asymmetric on purpose: it must cover instantly and leave without a lurch. */
const FADE_IN = 200;
const FADE_OUT = 170;

/**
 * How much of the crown's height the falling mark occupies. Verified on device:
 * at 0.42 the three bars land inside the crown's mouth — the dark opening
 * between its points — which is where a white mark holds its edges. Larger and
 * the shortest bar crosses onto the lit band, where it washes out.
 */
const MARK_RATIO = 0.42;

/**
 * The veil: a real backdrop blur, then a wash, then two crossed ramps.
 *
 * The blur alone is not the depth. It softens what is behind but does not push
 * it back, so the stack adds a flat wash and a vignette that darkens the edges
 * while leaving the middle open — that is what makes the covered screen read as
 * sitting further back rather than as a sheet of grey laid over it. Keeping the
 * composition independent of the blur also means it survives intact if a
 * platform ever declines to render one.
 *
 * The wash is light because the blur is doing half the job; doubling up muddies
 * the crown.
 */
const VEIL = "rgba(26,26,26,0.40)";
const EDGE = "rgba(10,10,10,0.48)";
/** The horizontal ramp is the weaker of the two — a phone is taller than wide. */
const EDGE_SIDE = "rgba(10,10,10,0.34)";

/**
 * A soft radial disc — the light the crown stands in.
 *
 * `id` is a parameter and not a constant because react-native-svg resolves
 * gradient ids across the whole tree: two discs sharing one id would both paint
 * with whichever definition mounted last.
 */
function Glow({
  id,
  size,
  color,
  opacity,
}: {
  id: string;
  size: number;
  color: string;
  /** Alpha at the centre; it falls to nothing at the rim. */
  opacity: number;
}) {
  return (
    <Svg width={size} height={size} style={{ position: "absolute" }}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          {/* The middle stop is what stops it reading as a flat vignette — a
              two-stop ramp falls off linearly and looks like a spotlight. */}
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.34} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={size / 2}
        cy={size / 2}
        rx={size / 2}
        ry={size / 2}
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

/**
 * The app's wait.
 *
 * Mount it as the LAST child of a screen's root view and it covers that screen:
 * the content behind goes blurred and dim, the crown sits in its own light in
 * the middle, and the mark falls into place on it until the wait is over. It is
 * the one loading state the app has — a platform spinner on a screen this dark
 * reads as a stall, and a wait we own should look like it belongs to us.
 *
 * It blocks every touch aimed at what is underneath. That is the point: the
 * screen behind is mid-flight and half its controls would do the wrong thing if
 * pressed, so the overlay takes the responder rather than merely covering the
 * pixels.
 *
 * `visible` is a prop rather than a mount/unmount decision so the fade-out
 * actually plays — a caller flipping the flag keeps the component mounted
 * through the 170ms exit, after which it renders nothing. Callers who would
 * rather mount it conditionally can: it fades in from zero either way, and
 * every animation it owns is stopped on unmount (the falling mark stops its own
 * loop in `ParadigmLoader`), so it is safe to put on a screen that mounts it
 * and tears it down a dozen times in a row.
 */
export function BrandLoading({
  label,
  visible = true,
  size = 144,
}: {
  /** One short line under the crown. Left off, the mark speaks for itself. */
  label?: string;
  visible?: boolean;
  /** Crown width in points; everything else is derived from it. */
  size?: number;
}) {
  const crownH = size / CROWN_ASPECT;
  const markH = crownH * MARK_RATIO;
  // The bloom is the light the crown stands in, so it has to be wider than the
  // object throwing it or it reads as a halo sticker.
  const bloom = size * 2.1;

  // Always starts hidden, even when `visible` is true on the first render — the
  // cover is supposed to arrive, not blink into existence.
  const fade = useRef(new Animated.Value(0)).current;
  // Kept mounted across the exit so the fade-out has something to fade.
  const [present, setPresent] = useState(visible);

  useEffect(() => {
    if (visible) setPresent(true);

    const anim = Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: visible ? FADE_IN : FADE_OUT,
      easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      // `finished` is false when a new `visible` interrupted this one — tearing
      // the overlay down then would flash the screen it is meant to be hiding.
      if (finished && !visible) setPresent(false);
    });

    return () => anim.stop();
  }, [visible, fade]);

  if (!present) return null;

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? "Loading"}
      // Hides the covered screen from VoiceOver, which otherwise keeps swiping
      // through controls the user can no longer press.
      accessibilityViewIsModal
      // Takes the responder outright. Covering the pixels is not enough — a
      // press that lands on the screen behind mid-wait fires an action against
      // state that is already being replaced.
      onStartShouldSetResponder={() => true}
      style={[
        StyleSheet.absoluteFill,
        { alignItems: "center", justifyContent: "center", opacity: fade },
      ]}
    >
      {/* A real gaussian backdrop blur on every device, iOS and Android alike —
          `expo-blur` rather than the glass effect this first shipped with, which
          was a live blur only on iOS 26+ and nothing whatsoever below it. The
          wash and ramps beneath still carry the depth, so the picture degrades
          to the same composition if a platform ever refuses the blur. */}
      <BlurView
        pointerEvents="none"
        intensity={38}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />

      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: VEIL }]}
      />
      {/* The two ramps are the depth. Top-to-bottom first, then side-to-side,
          both transparent through the middle so the crown keeps its air. */}
      <LinearGradient
        pointerEvents="none"
        colors={[EDGE, "transparent", EDGE]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[EDGE_SIDE, "transparent", EDGE_SIDE]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Nothing in here is a target — the root already owns the responder. */}
      <View pointerEvents="none" style={{ alignItems: "center" }}>
        <View
          style={{
            width: size,
            height: crownH,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Glow
            id="brand-loading-bloom"
            size={bloom}
            color={C.brand}
            opacity={0.22}
          />
          <Image
            source={CROWN}
            contentFit="contain"
            style={{ width: size, height: crownH }}
            // Decorative: the label (or the progressbar role above) names the
            // wait, and announcing "crown" here would say nothing useful.
            accessibilityElementsHidden
          />
          {/* No scrim between the crown and the mark. One was tried and cut:
              the bars land in the crown's own dark opening, so a disc behind
              them only smudged the gold it was supposed to be seating them
              against. */}
          <ParadigmLoader
            height={markH}
            color={C.text}
            style={{ position: "absolute" }}
          />
        </View>

        {label ? (
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 13,
              lineHeight: 18,
              letterSpacing: 0.3,
              color: C.sub,
              textAlign: "center",
              marginTop: 22,
              maxWidth: 260,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}
