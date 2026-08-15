import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { C, F } from "../theme/tokens";
import { BackHeader, Body, Display, MetallicButton } from "../components/ui";

/**
 * Decane's email sign-in is two-step: request a code, then verify it. With the
 * SDK running in-process there is no hosted page to host this, so the app owns
 * both steps.
 */
export default function EmailSignInScreen({
  onBack,
  onSubmitEmail,
  onSubmitCode,
  onResend,
  stage,
  busy = false,
  email,
}: {
  onBack?: () => void;
  onSubmitEmail?: (email: string) => void;
  onSubmitCode?: (code: string) => void;
  onResend?: () => void;
  stage: "email" | "code";
  busy?: boolean;
  email?: string;
}) {
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const inputStyle = {
    height: 54,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    color: C.text,
    fontFamily: F.body,
    fontSize: 15,
  } as const;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvas,
        paddingHorizontal: 22,
        paddingBottom: 30,
      }}
    >
      <BackHeader title="" onBack={onBack} />

      {stage === "email" ? (
        <>
          <View style={{ marginTop: 24 }}>
            <Display size={26}>What&apos;s your email?</Display>
            <Body
              size={13.5}
              color={C.sub}
              style={{ marginTop: 10, lineHeight: 21 }}
            >
              We&apos;ll send you a 6-digit code. No password to remember.
            </Body>
          </View>
          <View style={{ marginTop: 28, gap: 12 }}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="you@example.com"
              placeholderTextColor={C.dim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() =>
                emailValid && onSubmitEmail?.(value.trim())
              }
              style={inputStyle}
            />
            <MetallicButton
              label="Send code"
              onPress={() => onSubmitEmail?.(value.trim())}
              loading={busy}
              disabled={!emailValid}
            />
          </View>
        </>
      ) : (
        <>
          <View style={{ marginTop: 24 }}>
            <Display size={26}>Enter your code</Display>
            <Body
              size={13.5}
              color={C.sub}
              style={{ marginTop: 10, lineHeight: 21 }}
            >
              Sent to {email ?? "your email"}. It expires in a few minutes.
            </Body>
          </View>
          <View style={{ marginTop: 28, gap: 12 }}>
            <TextInput
              value={code}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                // Six digits is the whole code — submitting on entry saves a tap.
                if (digits.length === 6) onSubmitCode?.(digits);
              }}
              placeholder="123456"
              placeholderTextColor={C.dim}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              editable={!busy}
              style={[inputStyle, { fontFamily: F.mono, letterSpacing: 6 }]}
            />
            <MetallicButton
              label="Verify"
              onPress={() => onSubmitCode?.(code)}
              loading={busy}
              disabled={code.length !== 6}
            />
            <Pressable
              onPress={busy ? undefined : onResend}
              style={{ height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <Body size={13} color={C.sub}>
                Resend code
              </Body>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}
