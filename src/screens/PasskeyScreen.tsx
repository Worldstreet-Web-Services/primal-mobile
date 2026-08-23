import React from "react";
import { View, Pressable } from "react-native";
import { C } from "../theme/tokens";
import Svg, { Path, Circle } from "react-native-svg";
import { MetallicButton, Display, Body, Label } from "../components/ui";

/**
 * The last step of setup: biometric unlock for the app itself.
 *
 * What this screen sets up is the LOCAL app lock — `expo-local-authentication`,
 * the same Face ID that opens a banking app. It is not Decane's passkey tier,
 * which is a WebAuthn credential gating TEE signing, and it authorises nothing
 * on-chain. The copy used to describe the second while the button did the
 * first, which promised a security property this step does not provide.
 */
export default function PasskeyScreen({
  onEnable,
  onSkip,
  enabling = false,
  label = "Face ID",
  placeholder = false,
}: {
  onEnable?: () => void;
  onSkip?: () => void;
  enabling?: boolean;
  /** What this device actually offers — Face ID, Touch ID, Fingerprint. */
  label?: string;
  /**
   * The prompt behind that button is the DEV stand-in, not the real thing.
   * Said out loud on screen: a build whose lock always opens must never look
   * like a build whose lock is closed.
   */
  placeholder?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvas,
        paddingHorizontal: 22,
        paddingBottom: 30,
      }}
    >
      {/* Numbered to match the PIN step before it, so the sequence reads as a
          sequence: sign in, PIN, this. */}
      <View style={{ paddingTop: 10, paddingHorizontal: 2 }}>
        <Label>Step 3 of 3</Label>
      </View>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          paddingHorizontal: 12,
        }}
      >
        <View
          style={{
            width: 92,
            height: 92,
            borderRadius: 28,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: C.borderStrong,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Svg width={46} height={46} viewBox="0 0 24 24">
            <Path
              d="M8 3.5H5.5A2 2 0 0 0 3.5 5.5V8M16 3.5h2.5a2 2 0 0 1 2 2V8M8 20.5H5.5a2 2 0 0 1-2-2V16M16 20.5h2.5a2 2 0 0 0 2-2V16M9 15c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4"
              stroke={C.accent}
              strokeWidth={1.6}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={9} cy={10} r={0.9} fill={C.accent} />
            <Circle cx={15} cy={10} r={0.9} fill={C.accent} />
          </Svg>
        </View>
        <Display size={26}>Unlock with {label}</Display>
        <Body
          size={13.5}
          color={C.sub}
          style={{ textAlign: "center", lineHeight: 22 }}
        >
          Open KashPlus with {label} instead of typing your PIN every time. Your
          PIN still stands behind it, and it is still what authorises money
          leaving.
        </Body>
        {placeholder ? (
          <Body
            size={11.5}
            color={C.dim}
            style={{ textAlign: "center", lineHeight: 18 }}
          >
            This device has no {label} available, so the prompt is simulated and
            always succeeds. Development builds only.
          </Body>
        ) : null}
      </View>
      <View style={{ gap: 10 }}>
        <MetallicButton
          label={`Enable ${label}`}
          onPress={onEnable}
          loading={enabling}
        />
        <Pressable
          onPress={enabling ? undefined : onSkip}
          style={{
            height: 48,
            alignItems: "center",
            justifyContent: "center",
            opacity: enabling ? 0.45 : 1,
          }}
        >
          <Body size={14} color={C.sub}>
            Maybe later
          </Body>
        </Pressable>
        <Body size={11} color={C.dim} style={{ textAlign: "center" }}>
          Your PIN always works, whether or not you turn this on.
        </Body>
      </View>
    </View>
  );
}
