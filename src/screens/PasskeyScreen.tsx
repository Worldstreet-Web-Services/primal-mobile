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
    <View className="flex-1 bg-canvas px-[22px] pb-[30px]">
      {/* Numbered to match the PIN step before it, so the sequence reads as a
          sequence: sign in, PIN, this. */}
      <View className="pt-[10px] px-[2px]">
        <Label>Step 3 of 3</Label>
      </View>
      <View className="flex-1 items-center justify-center gap-[20px] px-[12px]">
        <View
          className="w-[92px] h-[92px] rounded-[28px] border border-border-strong items-center justify-center"
          style={{
            backgroundColor: C.card,
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
        <Display className="text-[26px] leading-[27.3px]">
          Unlock with {label}
        </Display>
        <Body className="text-[13.5px] text-sub text-center leading-[22px]">
          Open KashPlus with {label} instead of typing your PIN every time. Your
          PIN still stands behind it, and it is still what authorises money
          leaving.
        </Body>
      </View>
      <View className="gap-[10px]">
        <MetallicButton
          label={`Enable ${label}`}
          onPress={onEnable}
          loading={enabling}
        />
        <Pressable
          onPress={enabling ? undefined : onSkip}
          className="h-[48px] items-center justify-center"
          style={{
            opacity: enabling ? 0.45 : 1,
          }}
        >
          <Body className="text-[14px] text-sub">Maybe later</Body>
        </Pressable>
        <Body className="text-[11px] text-dim text-center">
          Your PIN always works, whether or not you turn this on.
        </Body>
      </View>
    </View>
  );
}
