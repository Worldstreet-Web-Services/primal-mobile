import React, { useState } from "react";
import { View } from "react-native";
import { C } from "../theme/tokens";
import {
  Label,
  Display,
  Body,
  PinDots,
  Keypad,
  Spinner,
} from "../components/ui";

/**
 * Two-phase entry: enter, then confirm. A 4-digit PIN typed once is a typo away
 * from locking the user out of every money-out route, and there is no "forgot
 * PIN" path on device — the confirm step is the only guard.
 */
export default function CreatePinScreen({
  onDone,
  saving = false,
}: {
  onDone?: (pin: string) => void;
  saving?: boolean;
}) {
  const [pin, setPin] = useState("");
  const [first, setFirst] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const confirming = first !== null;

  const onKey = (k: string) => {
    if (saving) return;

    // Any new digit is a fresh attempt: the last verdict stops applying the
    // moment the user starts answering it.
    setError(null);
    if (k === "del") {
      setPin(pin.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;

    const next = pin + k;
    setPin(next);
    if (next.length < 4) return;

    // Brief pause so the fourth dot is visibly filled before the screen moves.
    setTimeout(() => {
      if (!confirming) {
        setFirst(next);
        setPin("");
        return;
      }
      if (next === first) {
        onDone?.(next);
        return;
      }
      // Mismatch: start over from the first entry, not the confirm. The dots
      // shake and buzz where the digits were typed, so the correction reads as
      // a rejection of *this* entry rather than a notice about the screen.
      setFirst(null);
      setPin("");
      setShake((n) => n + 1);
      setError("Those didn’t match. Start again.");
    }, 220);
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.canvas,
        paddingHorizontal: 24,
        paddingBottom: 34,
      }}
    >
      <View style={{ paddingTop: 10 }}>
        <Label>Step 2 of 3</Label>
      </View>
      <View style={{ marginTop: 26 }}>
        <Display size={26}>
          {confirming ? "Confirm your" : "Create your"}
          {"\n"}transaction PIN
        </Display>
        <Body
          size={13.5}
          color={C.sub}
          style={{ marginTop: 10, lineHeight: 21 }}
        >
          {confirming
            ? "Enter the same 4 digits again."
            : "4 digits. You’ll enter it every time money leaves KashPlus."}
        </Body>
      </View>
      <View style={{ marginTop: 44 }}>
        <PinDots filled={pin.length} shake={shake} />
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {saving ? (
          <Spinner color={C.silver} />
        ) : error ? (
          <Body size={12.5} color={C.down}>
            {error}
          </Body>
        ) : null}
      </View>
      <Keypad onKey={onKey} />
    </View>
  );
}
