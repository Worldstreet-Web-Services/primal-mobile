import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { GoogleMark, KingsChatMark } from "@/components/icons";
import { ParadigmMark } from "@/components/ParadigmMark";
import { MetalButton, QuietButton } from "@/components/ui";
import { C, F } from "@/theme/tokens";

/**
 * Envelope for the email row. Local because it exists for exactly this one
 * placement — promote it into `icons.tsx` the day a second caller appears.
 */
function MailMark({ size = 19, color = C.text }: { size?: number; color?: string }) {
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

/**
 * The three ways in, all on the surface. This screen exists to ask exactly one
 * question — which identity — so every answer to it is visible without a
 * disclosure step. KingsChat takes the metal tier because it is the
 * differentiator for this audience; the other two are quiet.
 *
 * Apple is not here on purpose. Decane's `AuthMethod` is google | email |
 * kingschat — Apple would need an external provider registered in the
 * dashboard, and offering a button that can only apologise is worse than not
 * offering it.
 */
const METHODS = [
  { id: "kingschat", label: "Continue with KingsChat", tone: "metal" },
  { id: "google", label: "Continue with Google", tone: "quiet" },
  { id: "email", label: "Continue with email", tone: "quiet" },
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
 * Left-aligned and un-drawered on purpose: the pitch got the composed,
 * centered treatment one screen back. This one is a decision, and a decision
 * reads best set like a page.
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
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvas,
        paddingTop: insets.top + 14,
        paddingHorizontal: 26,
        paddingBottom: Math.max(insets.bottom, 24) + 6,
      }}
    >
      {/* Lockup: the flat vector mark, not the gold hero. The hero is the
          welcome screen's subject; here the brand is just a signature. */}
      <Animated.View
        style={[
          { flexDirection: "row", alignItems: "center", gap: 10 },
          step(0),
        ]}
      >
        <ParadigmMark height={26} color={C.text} />
        <Text
          style={{
            fontFamily: F.display,
            fontSize: 27,
            letterSpacing: -0.4,
            color: C.text,
          }}
        >
          Paradigm
        </Text>
      </Animated.View>

      {/* The headline carries the screen on its own — set large, left, and in
          one colour. An accent on the third line turns a statement into a
          slogan, and this audience reads the restraint as the confidence. */}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Animated.View style={step(1)}>
          {["One Platform.", "Every Strategy.", "No Compromise."].map((line) => (
            <Text
              key={line}
              style={{
                fontFamily: F.displayBold,
                fontSize: 44,
                lineHeight: 53,
                letterSpacing: -1,
                color: C.text,
              }}
            >
              {line}
            </Text>
          ))}
        </Animated.View>
      </View>

      {METHODS.map((m, i) => {
        const Pill = m.tone === "metal" ? MetalButton : QuietButton;
        const ink = m.tone === "metal" ? C.metalInk : C.text;
        return (
          <Animated.View
            key={m.id}
            style={[{ marginTop: i === 0 ? 0 : 12 }, step(i + 2)]}
          >
            <Pill
              label={m.label}
              icon={
                m.id === "kingschat" ? (
                  <KingsChatMark color={ink} />
                ) : m.id === "google" ? (
                  <GoogleMark />
                ) : (
                  <MailMark color={ink} />
                )
              }
              onPress={() => onSignIn?.(m.id)}
              loading={pending === m.id}
              disabled={busy && pending !== m.id}
            />
          </Animated.View>
        );
      })}

      <Animated.View style={[{ marginTop: 22 }, step(6)]}>
        <Text
          style={{
            fontFamily: F.body,
            fontSize: 11.5,
            lineHeight: 17,
            color: C.dim,
          }}
        >
          {creatingWallet ? (
            "Creating your wallet — this takes a few seconds. Keep the app open."
          ) : (
            <>
              By continuing you agree to Paradigm&apos;s{" "}
              <Text style={{ color: C.sub }}>Terms</Text> and{" "}
              <Text style={{ color: C.sub }}>Privacy Policy</Text>. A smart
              wallet is created on your behalf — Paradigm can never move your
              funds.
            </>
          )}
        </Text>
      </Animated.View>
    </View>
  );
}
