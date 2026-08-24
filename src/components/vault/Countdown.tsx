import React, { useEffect, useMemo, useState } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { formatClock } from "@/lib/vault/format";
import { C, F } from "@/theme/tokens";

const URGENT_S = 10;

// One shape for the digits whichever colour they are wearing, so the calm and
// urgent clocks never shift by a hair when the state flips.
const DIGITS = {
  fontFamily: F.monoSemibold,
  fontSize: 48,
  letterSpacing: 2,
} as const;

const CAPTION = {
  fontFamily: F.mono,
  fontSize: 10,
  letterSpacing: 2,
  textAlign: "center",
} as const;

/**
 * A game's countdown. Derived from the game's on-chain endTime (wall-clock
 * ms) so it stays correct across background/foreground; a small interval
 * samples the clock and drives re-renders, the math stays anchored to the
 * deadline. Presentational — the store owns which game is on stage.
 *
 * The last seconds are staged as a held breath rather than an alarm: the
 * amber walks to `down` over most of a second, and the light behind the
 * digits swells and falls on a slow cycle. Nothing blinks.
 */
export function Countdown({ deadlineMs }: { deadlineMs: number | null }) {
  // The wall clock, as sampled by the interval below — render never reads
  // Date.now() itself. A sample is at most 250ms old, so it is trusted
  // against ANY current deadline: every wager re-mints the deadline (WS
  // frames, polls, chain overlays), and gating on a same-deadline sample
  // would flash the clock stale on each re-mint.
  const [tick, setTick] = useState<number | null>(() =>
    deadlineMs === null ? null : Date.now(),
  );

  useEffect(() => {
    if (deadlineMs === null) return;
    setTick(Date.now());
    const id = setInterval(() => setTick(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const active = deadlineMs !== null;
  const remaining =
    active && tick !== null ? Math.max(0, (deadlineMs - tick) / 1000) : 0;
  const urgent = active && remaining <= URGENT_S && remaining > 0;
  // Clock ran out but the keeper hasn't confirmed the settlement yet. The
  // store's expiry watchdog is polling for it; this window lasts a few
  // seconds, and "one wager steals the pot" would be a lie during it.
  const settling = active && remaining <= 0;

  // 0 calm, 1 urgent. Colour interpolation has to run on the JS driver, so
  // the breath below rides the same driver to stay composable with it.
  const heat = useMemo(() => new Animated.Value(0), []);
  const breath = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(heat, {
      toValue: urgent || settling ? 1 : 0,
      duration: 900,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [heat, urgent, settling]);

  useEffect(() => {
    if (!urgent) {
      Animated.timing(breath, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, urgent]);

  const caption = settling
    ? "SETTLING THE ROUND"
    : urgent
      ? "FINAL SECONDS — ONE WAGER TAKES IT"
      : active
        ? "UNTIL THE POT PAYS OUT"
        : "START A GAME AND THE CLOCK IS YOURS";

  return (
    <View className="items-center">
      <View className="items-center justify-center">
        {active ? (
          // Dark until the round is nearly over: the light only arrives with
          // the urgency, and then it swells and falls. A radial falloff, so
          // it reads as light in the case rather than a lit pill.
          <Animated.View
            pointerEvents="none"
            className="absolute w-[280px] h-[130px]"
            style={{
              opacity: Animated.multiply(
                heat,
                breath.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
              ),
              transform: [
                {
                  scale: breath.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1.06],
                  }),
                },
              ],
            }}
          >
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient
                  id="clockHeat"
                  cx="50%"
                  cy="50%"
                  rx="50%"
                  ry="50%"
                >
                  <Stop offset="0" stopColor={C.down} stopOpacity={0.3} />
                  <Stop offset="0.55" stopColor={C.down} stopOpacity={0.12} />
                  <Stop offset="1" stopColor={C.down} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#clockHeat)"
              />
            </Svg>
          </Animated.View>
        ) : null}
        {active ? (
          <Animated.Text
            style={{
              ...DIGITS,
              color: heat.interpolate({
                inputRange: [0, 1],
                outputRange: [C.amber, C.down],
              }),
            }}
          >
            {formatClock(remaining)}
          </Animated.Text>
        ) : (
          <Text style={{ ...DIGITS, color: C.dim }}>
            {formatClock(remaining)}
          </Text>
        )}
      </View>
      <Animated.Text
        style={{
          ...CAPTION,
          marginTop: 12,
          color: active
            ? heat.interpolate({
                inputRange: [0, 1],
                outputRange: [C.dim, C.down],
              })
            : C.dim,
        }}
      >
        {caption}
      </Animated.Text>
    </View>
  );
}
