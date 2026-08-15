import React, { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { C } from "../theme/tokens";
import {
  MetallicButton,
  Label,
  Body,
  Display,
  PinDots,
  Keypad,
} from "../components/ui";

// Design 3e: app unlock — metallic brand block, Face ID / passkey, PIN fallback.
export default function UnlockScreen({
  onPin,
  onBiometrics,
  checking = false,
  biometricsAvailable = true,
  biometricLabel = "Face ID",
}: {
  /** Resolves false on a wrong PIN so the dots can clear for a retry. */
  onPin?: (pin: string) => Promise<boolean>;
  onBiometrics?: () => void;
  checking?: boolean;
  biometricsAvailable?: boolean;
  biometricLabel?: string;
}) {
  const [pin, setPin] = useState("");

  const handleKey = async (k: string) => {
    if (checking) return;
    if (k === "del") {
      setPin(pin.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;

    const next = pin + k;
    setPin(next);
    if (next.length < 4) return;

    const ok = await onPin?.(next);
    // Clear on failure so the next attempt starts from an empty keypad.
    if (!ok) setPin("");
  };
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvas,
        paddingHorizontal: 22,
        paddingTop: 20,
        paddingBottom: 30,
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <View
          style={{
            shadowColor: C.brand,
            shadowOpacity: 0.25,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <Image
            source={require("@/assets/images/logo.png")}
            style={{ width: 96, height: 96, borderRadius: 26 }}
            contentFit="cover"
          />
        </View>
        <Display size={36} style={{ letterSpacing: 0.5 }}>
          Paradigm
        </Display>
        <Body
          size={14}
          color={C.sub}
          style={{ textAlign: "center", lineHeight: 21 }}
        >
          One account. One balance.{"\n"}Every rail.
        </Body>
      </View>
      {biometricsAvailable ? (
        <MetallicButton
          label={`Unlock with ${biometricLabel}`}
          onPress={onBiometrics}
          loading={checking}
        />
      ) : null}
      <Label style={{ textAlign: "center", marginTop: 20 }}>
        {biometricsAvailable ? "Or enter your PIN" : "Enter your PIN"}
      </Label>
      <View style={{ marginTop: 14 }}>
        <PinDots filled={pin.length} />
      </View>
      <View style={{ marginTop: 22 }}>
        <Keypad onKey={handleKey} />
      </View>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", lineHeight: 17, marginTop: 14 }}
      >
        Signed in a secure enclave, unlocked by your passkey
      </Body>
    </View>
  );
}
