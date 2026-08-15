import React, { useState } from 'react';
import { View } from 'react-native';
import { C } from '../theme/tokens';
import { Label, Display, Body, PinDots, Keypad, Spinner } from '../components/ui';

/**
 * Two-phase entry: enter, then confirm. A 4-digit PIN typed once is a typo away
 * from locking the user out of every money-out route, and there is no "forgot
 * PIN" path on device — the confirm step is the only guard.
 */
export default function CreatePinScreen({
  onDone,
  onMismatch,
  saving = false,
}: {
  onDone?: (pin: string) => void;
  onMismatch?: () => void;
  saving?: boolean;
}) {
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState<string | null>(null);

  const confirming = first !== null;

  const onKey = (k: string) => {
    if (saving) return;

    if (k === 'del') {
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
        setPin('');
        return;
      }
      if (next === first) {
        onDone?.(next);
        return;
      }
      // Mismatch: start over from the first entry, not the confirm.
      setFirst(null);
      setPin('');
      onMismatch?.();
    }, 220);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 24, paddingBottom: 34 }}>
      <View style={{ paddingTop: 10 }}><Label>Step 2 of 3</Label></View>
      <View style={{ marginTop: 26 }}>
        <Display size={26}>
          {confirming ? `Confirm your\ntransaction PIN` : `Create your\ntransaction PIN`}
        </Display>
        <Body size={13.5} color={C.sub} style={{ marginTop: 10, lineHeight: 21 }}>
          {confirming
            ? 'Enter the same 4 digits again.'
            : ' 4 digits. You’ll enter it every time money leaves Primal.'.trim()}
        </Body>
      </View>
      <View style={{ marginTop: 44 }}><PinDots filled={pin.length} /></View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {saving ? <Spinner color={C.silver} /> : null}
      </View>
      <Keypad onKey={onKey} />
    </View>
  );
}
