import React, { useState } from 'react';
import { View } from 'react-native';
import { C } from '../theme/tokens';
import { Label, Display, Body, PinDots, Keypad } from '../components/ui';

export default function CreatePinScreen({ onDone }: { onDone?: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const onKey = (k: string) => {
    const next = k === 'del' ? pin.slice(0, -1) : pin.length < 4 ? pin + k : pin;
    setPin(next);
    if (next.length === 4 && onDone) setTimeout(() => onDone(next), 350);
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 24, paddingBottom: 34 }}>
      <View style={{ paddingTop: 10 }}><Label>Step 2 of 3</Label></View>
      <View style={{ marginTop: 26 }}>
        <Display size={26}>Create your{'\n'}transaction PIN</Display>
        <Body size={13.5} color={C.sub} style={{ marginTop: 10, lineHeight: 21 }}>4 digits. You’ll enter it every time money leaves Paradigm.</Body>
      </View>
      <View style={{ marginTop: 44 }}><PinDots filled={pin.length} /></View>
      <View style={{ flex: 1 }} />
      <Keypad onKey={onKey} />
    </View>
  );
}
