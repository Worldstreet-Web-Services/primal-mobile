import { Logo } from "@/components/Logo";
import {
  Body,
  Display,
  Keypad,
  Label,
  MetallicButton,
  PinDots,
  Spinner,
} from "@/components/ui";
import { C } from "@/theme/tokens";
import { useState } from "react";
import { View } from "react-native";

// Design 3e: app unlock — metallic brand block, Face ID / passkey, PIN fallback.
export default function UnlockScreen({
  onPin,
  onBiometrics,
  checking = false,
  biometricsAvailable = true,
  biometricLabel = "Face ID",
  error = null,
}: {
  /** Resolves false on a wrong PIN so the dots can clear for a retry. */
  onPin?: (pin: string) => Promise<boolean>;
  onBiometrics?: () => void;
  checking?: boolean;
  biometricsAvailable?: boolean;
  biometricLabel?: string;
  /**
   * Why the last attempt failed. Takes the place of the prompt above the dots
   * rather than arriving as a toast — the answer belongs on the thing that was
   * rejected, not in a banner over the top of the screen.
   */
  error?: string | null;
}) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);

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
    // Clear on failure so the next attempt starts from an empty keypad, and
    // bump the nonce so the dots reject it whether or not the copy changed.
    if (!ok) {
      setPin("");
      setShake((n) => n + 1);
    }
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
          <Logo height={104} />
        </View>
        <Display size={36} style={{ letterSpacing: 0.5 }}>
          KashPlus
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
      {/* Unlocking is genuinely slow — the enclave opens the wallet and the
          session is re-established — so the wait gets its own state rather
          than a frozen keypad that reads as a dropped tap. */}
      {checking ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            marginTop: 20,
          }}
        >
          <Spinner color={C.brandSoft} />
          <Label style={{ textAlign: "center" }}>Unlocking…</Label>
        </View>
      ) : (
        <Label
          style={{
            textAlign: "center",
            marginTop: 20,
            color: error ? C.down : undefined,
          }}
        >
          {error ??
            (biometricsAvailable ? "Or enter your PIN" : "Enter your PIN")}
        </Label>
      )}
      <View style={{ marginTop: 14 }}>
        <PinDots filled={pin.length} shake={shake} />
      </View>
      {/* Dimmed, not unmounted: the keypad keeps its place so the screen does
          not jump, and `handleKey` already ignores presses while checking. */}
      <View style={{ marginTop: 22, opacity: checking ? 0.35 : 1 }}>
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
