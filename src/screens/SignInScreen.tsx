import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { ArtSlot } from "@/components/home";
import { KingsChatMark } from "@/components/icons";
import { ParadigmMark } from "@/components/ParadigmMark";
import { MetalButton, OutlineButton } from "@/components/ui";
import { C, F } from "@/theme/tokens";

/** The screen's gutter. */
const PAD = 26;

/** Air between the foot of the lockup and the top of the diagram's box. */
const FIELD_GAP = 8;

/**
 * Envelope for the email row. Local because it exists for exactly this one
 * placement — promote it into `icons.tsx` the day a second caller appears.
 */
function MailMark({
  size = 19,
  color = C.text,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size * 0.78} viewBox="0 0 24 19" fill="none">
      <Path
        d="M2.4 3.2h19.2v12.6H2.4z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="m2.9 3.8 9.1 6.3 9.1-6.3"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/* ── The orbit field ──────────────────────────────────────────────────────
 *
 * The upper two thirds of the screen: four product objects floating on faint
 * concentric rings. It is the same argument the headline then puts into words —
 * one system, several ways to use it — so the rings are not decoration, they
 * are the diagram.
 *
 * Everything here is a FRACTION OF THE FIELD'S WIDTH, never a point value. The
 * field is full-bleed (it runs under the screen's gutters on purpose, so the
 * bottom-left object is clipped by the edge exactly as it is in the reference),
 * and a composition pinned to points would come apart between an SE and a Pro
 * Max. Sized off width alone, it scales as one object.
 */

/**
 * Ring radii, as fractions of the field width. The middle two carry objects;
 * the innermost and the outermost are empty on purpose — the outer one is wider
 * than the screen (0.6 against a 0.5 half-width), and running off both gutters
 * is what makes the system read as bigger than the frame rather than as a
 * target painted on it.
 */
const RINGS = [0.24, 0.4, 0.49, 0.6];

/** Centre of the ring system, as a fraction of the field width. */
const ORBIT_CX = 0.5;
const ORBIT_CY = 0.42;

/**
 * Field height, again as a fraction of its width: far enough to clear the
 * outermost ring at the foot, and deliberately NOT far enough to clear it at
 * the head — the top arc runs off the screen, which is what stops the diagram
 * reading as a self-contained badge.
 */
const ORBIT_H = 0.97;

type Satellite = {
  id: string;
  /**
   * Index into `RINGS`. `-1` parks the object at the centre of the system,
   * which is the one position that is not on a ring.
   */
  ring: number;
  /** Degrees anticlockwise from east — where on its ring the object sits. */
  angle: number;
  /** Diameter, as a fraction of the field width. */
  size: number;
  /**
   * PLACEHOLDER SLOT. Drop the supplied render in —
   * `art: require("../../assets/images/orbit/earn.png")` — and `ArtSlot` swaps
   * its glass stand-in for the artwork with no other change. Until then the
   * layout is already final, which is the whole point of leaving it undefined.
   */
  art?: number;
  /** Tint of the stand-in, so the four don't read as one repeated object. */
  tint: string;
  /** Read out in place of the artwork. */
  label: string;
};

const SATELLITES: Satellite[] = [
  {
    id: "earn",
    ring: 1,
    angle: 130,
    size: 0.135,
    tint: C.green,
    label: "Earn",
  },
  {
    id: "games",
    ring: -1,
    angle: 0,
    size: 0.125,
    tint: C.silver,
    label: "Games",
  },
  {
    id: "trade",
    ring: 1,
    angle: 0,
    size: 0.125,
    tint: C.green,
    label: "Trade",
  },
  {
    id: "markets",
    ring: 2,
    angle: 221,
    size: 0.12,
    tint: C.silver,
    label: "Markets",
  },
];

/** Where a satellite lands, in fractions of the field width. */
function place(s: Satellite) {
  if (s.ring < 0) return { x: ORBIT_CX, y: ORBIT_CY };
  const r = RINGS[s.ring];
  const t = (s.angle * Math.PI) / 180;
  // Screen y grows downward, so the sine subtracts rather than adds.
  return { x: ORBIT_CX + r * Math.cos(t), y: ORBIT_CY - r * Math.sin(t) };
}

/**
 * One object in its halo. The halo is the reason a placeholder does not read as
 * a hole: a lit object on true black needs something around it to stand in, or
 * it reads as a sticker laid on the glass.
 */
function Orbiter({
  satellite,
  width,
  drift,
}: {
  satellite: Satellite;
  /** Field width in points — everything below is a fraction of it. */
  width: number;
  /** 0→1 driver for the idle float. Each object reads it at its own phase. */
  drift: Animated.Value;
}) {
  const { x, y } = place(satellite);
  const d = satellite.size * width;

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={satellite.label}
      style={{
        position: "absolute",
        left: x * width - d / 2,
        top: y * width - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.hairline,
        transform: [
          {
            translateY: drift.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0, -d * 0.06, 0],
            }),
          },
        ],
      }}
    >
      <ArtSlot source={satellite.art} size={d * 0.68} tint={satellite.tint} />
    </Animated.View>
  );
}

function OrbitField({ width }: { width: number }) {
  const height = width * ORBIT_H;

  // One driver per object so they float out of phase; a shared one makes four
  // objects bob in lockstep, which reads as the whole screen breathing.
  const drifts = useRef(SATELLITES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = drifts.map((drift, i) =>
      Animated.loop(
        Animated.timing(drift, {
          toValue: 1,
          // Deliberately uneven durations: the four never resynchronise into a
          // pulse, which is the difference between drift and a heartbeat.
          duration: 5200 + i * 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [drifts]);

  return (
    <View
      pointerEvents="none"
      style={{ width, height, overflow: "hidden" }}
      accessible={false}
    >
      <Svg width={width} height={height}>
        {RINGS.map((r) => (
          <Circle
            key={r}
            cx={ORBIT_CX * width}
            cy={ORBIT_CY * width}
            r={r * width}
            stroke={C.hairline}
            strokeWidth={1}
            fill="none"
          />
        ))}
      </Svg>
      {SATELLITES.map((s, i) => (
        <Orbiter key={s.id} satellite={s} width={width} drift={drifts[i]} />
      ))}
      {/* The field does not end, it dissolves. Without this the lowest ring
          crosses the headline and the two compete; with it the diagram sinks
          into the ground the words are set on. */}
      <LinearGradient
        colors={["transparent", C.canvas]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: height * 0.34,
        }}
      />
    </View>
  );
}

/* ── The screen ──────────────────────────────────────────────────────────── */

/**
 * The headline, as segments rather than strings, because two of its words carry
 * the accent and a `<Text>` cannot change colour halfway through without being
 * split. Set centred and tight under the diagram: the words name what the
 * objects above them are.
 */
const HEADLINE: { t: string; accent?: boolean }[][] = [
  [{ t: "One " }, { t: "Paradigm.", accent: true }],
  [{ t: "Multiple ways to put" }],
  [{ t: "Money", accent: true }, { t: " to work." }],
];

/**
 * The two ways in.
 *
 * KingsChat leads on the OUTLINE tier — a stroke around nothing, the canvas
 * showing straight through it — and email follows on the metal one. That is the
 * reverse of the old arrangement and deliberate: the reference gives the loud
 * silver pill to the method that always works, and lets the differentiator sit
 * first in reading order without shouting.
 *
 * Outline rather than the bevelled `QuietButton`: on true black a dark
 * bevelled face has nothing to be dark against, so the pair read as one solid
 * button and one smudge. Drawn as a line instead, the first row recedes without
 * disappearing, which is exactly what the reference shows.
 *
 * Google is not on this screen. Decane still supports it and `/signin` still
 * handles `google` verbatim, so restoring it is one row here and nothing else —
 * but the reference offers two doors, and a third quiet row directly under the
 * first made the pair read as a list rather than as a choice.
 *
 * Apple is absent for a harder reason: Decane's `AuthMethod` is
 * google | email | kingschat, so an Apple button could only apologise.
 */
const METHODS = [
  { id: "kingschat", label: "Continue with KingsChat", tone: "outline" },
  { id: "email", label: "Continue with email", tone: "metal" },
] as const;

/**
 * Sign-in, and only sign-in.
 *
 * This screen answers one question — *which identity* — so every row on it is
 * an answer to that question. There is deliberately no "I already have an
 * account" link: authentication here is Decane Connect Kit, where the same
 * provider handshake creates a wallet on first use and restores it (from the
 * Shamir shares) on every use after. A registration door would lead to this
 * exact room, so the honest fix is one line of copy saying so.
 *
 * Centred and composed, per the 2026-08-21 reference. It used to be set like a
 * page — left-aligned, headline hard against the gutter — on the argument that
 * a decision reads best that way. The reference puts a diagram above the words,
 * and a centred lockup over a left-set headline is two grids on one screen, so
 * the whole column is centred now.
 */
export default function SignInScreen({
  onSignIn,
  pending = null,
  creatingWallet = false,
}: {
  onSignIn?: (method: string) => void;
  /** Which provider is mid-flight — that row loads, the others dim out. */
  pending?: string | null;
  /** First-time key generation: Shamir split + enclave session, several seconds. */
  creatingWallet?: boolean;
}) {
  const busy = pending !== null;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  /**
   * Measured height of the lockup row, which is all the absolutely-placed
   * diagram needs in order to hang directly under it. Zero until first layout;
   * the entrance fade covers that frame.
   *
   * Measured rather than a constant because the lockup is type, and type grows
   * with the reader's text-size setting — a hardcoded offset would slide the
   * whole diagram under the wordmark on exactly the devices least able to
   * afford it.
   */
  const [lockup, setLockup] = useState(0);

  // One driver for the page; each block reads a different slice of it, which is
  // what makes them arrive staggered off a single animation.
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(copy, {
      toValue: 1,
      duration: 780,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [copy]);

  /** Slice `copy` into a rise-and-fade for the nth block down the page. */
  const step = (i: number) => {
    const start = i * 0.12;
    const range = [start, Math.min(start + 0.5, 1)];
    return {
      opacity: copy.interpolate({
        inputRange: range,
        outputRange: [0, 1],
        extrapolate: "clamp" as const,
      }),
      transform: [
        {
          translateY: copy.interpolate({
            inputRange: range,
            outputRange: [16, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  return (
    // Two layers. The outer one is the stage and carries NO padding, which is
    // what lets the diagram be positioned against the screen itself: an
    // absolute child of a padded parent is inset by that padding, so anchoring
    // the art to a padded box would quietly hand it the gutters back. The
    // padded column is the inner one.
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      {/* The diagram is a LAYER, not a row: absolutely placed, full-bleed, hung
          off the bottom of the lockup, and first in document order so it paints
          behind everything. Out of the flex flow entirely — it no longer takes
          space from the copy, and the copy no longer sizes it. Where the two
          meet on a short screen, the field's own fade to canvas is what keeps
          the headline off the rings. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            top: insets.top + 75 + lockup + FIELD_GAP,
          },
          step(1),
        ]}
      >
        <OrbitField width={width} />
      </Animated.View>

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 14,
          paddingHorizontal: PAD,
          paddingBottom: Math.max(insets.bottom, 24) + 6,
          alignItems: "center",
        }}
      >
        {/* Lockup: the flat vector mark, not the gold hero. The hero is the
            welcome screen's subject; here the brand is just a signature. */}
        <Animated.View
          onLayout={(e) => setLockup(e.nativeEvent.layout.height)}
          style={[
            { flexDirection: "row", alignItems: "center", gap: 10 },
            step(0),
          ]}
        >
          <ParadigmMark height={30} color={C.text} />
          <Text
            style={{
              fontFamily: F.displayBold,
              fontSize: 31,
              letterSpacing: -0.6,
              color: C.text,
            }}
          >
            KashPlus
          </Text>
        </Animated.View>

        {/* Where the diagram used to sit. It is a layer now, so what is left here
          is the space it occupies — this is what holds the copy down at the
          foot of the screen. */}
        <View style={{ flex: 1 }} />

        <Animated.View style={[{ marginBottom: 34 }, step(2)]}>
          {HEADLINE.map((line, i) => (
            <Text
              key={i}
              style={{
                fontFamily: F.displayBold,
                fontSize: 32,
                lineHeight: 37,
                letterSpacing: -0.8,
                color: C.text,
                textAlign: "center",
              }}
            >
              {line.map((seg, j) => (
                <Text
                  key={j}
                  style={seg.accent ? { color: C.green } : undefined}
                >
                  {seg.t}
                </Text>
              ))}
            </Text>
          ))}
        </Animated.View>

        {METHODS.map((m, i) => {
          const metal = m.tone === "metal";
          const ink = metal ? C.metalInk : C.text;
          // Both tiers get the same height, radius and label spec, so the pair
          // reads as one control with two answers rather than as two buttons.
          const common = {
            label: m.label,
            icon: metal ? (
              <MailMark color={ink} />
            ) : (
              <KingsChatMark color={ink} />
            ),
            onPress: () => onSignIn?.(m.id),
            loading: pending === m.id,
            disabled: busy && pending !== m.id,
          };
          return (
            <Animated.View
              key={m.id}
              style={[
                { alignSelf: "stretch", marginTop: i === 0 ? 0 : 14 },
                step(i + 3),
              ]}
            >
              {metal ? (
                <MetalButton {...common} />
              ) : (
                <OutlineButton tone="auth" {...common} />
              )}
            </Animated.View>
          );
        })}

        {/* Not in the reference, and kept anyway: the reference has no legal line
          because a mock does not have to have one. Dropping the consent notice
          is a legal call, not a layout one — set it small, dim and centred so
          it sits under the pair without competing, and let the owner say the
          word if it goes. */}
        <Animated.View style={[{ marginTop: 18 }, step(5)]}>
          <Text
            style={{
              fontFamily: F.body,
              fontSize: 11,
              lineHeight: 16,
              color: C.dim,
              textAlign: "center",
            }}
          >
            {creatingWallet ? (
              "Creating your wallet — this takes a few seconds. Keep the app open."
            ) : (
              <>
                By continuing you agree to KashPlus&apos;s{" "}
                <Text style={{ color: C.sub }}>Terms</Text> and{" "}
                <Text style={{ color: C.sub }}>Privacy Policy</Text>.
              </>
            )}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}
