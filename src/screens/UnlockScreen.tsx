import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import { MetallicButton, Label, Body, Display, PinDots, Keypad } from '../components/ui';

// Design 3e: app unlock — metallic brand block, Face ID / passkey, PIN fallback.
export default function UnlockScreen({ onUnlock }: { onUnlock?: () => void }) {
  const [pin, setPin] = useState('');
  const handleKey = (k: string) => {
    if (k === 'del') { setPin(pin.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4 && onUnlock) onUnlock();
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 30 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <View style={{ shadowColor: '#fff', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 }}>
          <LinearGradient colors={C.metal} style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <View pointerEvents='none' style={{ position: 'absolute', top: 1, left: 8, right: 8, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <Text style={{ fontFamily: F.displayBold, fontSize: 32, color: C.ink }}>P</Text>
          </LinearGradient>
        </View>
        <Display size={36} style={{ letterSpacing: 0.5 }}>Primal</Display>
        <Body size={14} color={C.sub} style={{ textAlign: 'center', lineHeight: 21 }}>One account. One balance.{'\n'}Every rail.</Body>
      </View>
      <MetallicButton label='Unlock with Face ID' onPress={onUnlock} />
      <Label style={{ textAlign: 'center', marginTop: 20 }}>Or enter your PIN</Label>
      <View style={{ marginTop: 14 }}>
        <PinDots filled={pin.length} />
      </View>
      <View style={{ marginTop: 22 }}>
        <Keypad onKey={handleKey} />
      </View>
      <Body size={11} color={C.dim} style={{ textAlign: 'center', lineHeight: 17, marginTop: 14 }}>Signed in a secure enclave, unlocked by your passkey</Body>
    </View>
  );
}
