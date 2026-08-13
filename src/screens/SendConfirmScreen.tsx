import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, F } from '../theme/tokens';
import { Card, BackHeader, Mono, Body, Display, PinDots, Keypad } from '../components/ui';

// Design 4e: send confirm — name enquiry, provider fee, PIN to send.
const PIN_LENGTH = 4;
const recipient = { name: 'ADEBAYO KEHINDE', bank: 'GTBank', account: '0123 456 789' };
const amount = { naira: '₦45,000', kobo: '.00', usd: '≈ $29.30 USD', fee: '₦26.88', total: '₦45,026.88' };

export default function SendConfirmScreen({ onBack, onConfirm }: { onBack?: () => void; onConfirm?: () => void }) {
  const [pin, setPin] = useState('');

  const handleKey = (k: string) => {
    if (k === 'del') {
      setPin(pin.slice(0, -1));
      return;
    }
    if (pin.length >= PIN_LENGTH) return;
    const next = pin + k;
    setPin(next);
    if (next.length === PIN_LENGTH && onConfirm) setTimeout(onConfirm, 350);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <BackHeader title='Send' onBack={onBack} />
      </View>
      <Card style={{ marginTop: 16, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: 'rgba(124,231,176,0.4)', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 }}>
        <View style={{ width: 40, height: 40, borderRadius: 21, backgroundColor: C.upBg, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={18} height={18} viewBox='0 0 24 24'>
            <Path d='m5 12.5 4.5 4.5L19 7.5' stroke={C.up} strokeWidth={2.2} strokeLinecap='round' strokeLinejoin='round' fill='none' />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <Body size={14} semibold style={{ letterSpacing: 0.3 }}>{recipient.name}</Body>
          <Mono size={11.5} color={C.sub} style={{ marginTop: 2 }}>{recipient.bank} · {recipient.account}</Mono>
        </View>
        <Body size={10} color={C.up} semibold>Name enquiry ✓</Body>
      </Card>
      <View style={{ marginTop: 26, alignItems: 'center' }}>
        <Body size={11.5} color={C.dim}>You're sending</Body>
        <Display size={44} style={{ marginTop: 6 }}>{amount.naira}<Display size={26} color={C.dim}>{amount.kobo}</Display></Display>
        <Mono size={12} color={C.sub} style={{ marginTop: 4 }}>{amount.usd}</Mono>
      </View>
      <Card style={{ marginTop: 20, marginHorizontal: 20, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.hairline }}>
          <Body size={12.5} color={C.sub}>Fee</Body>
          <Mono size={12.5} color={C.text}>{amount.fee} <Mono size={12.5} color={C.dim}>· provider quote</Mono></Mono>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 }}>
          <Body size={12.5} color={C.sub}>Total debit</Body>
          <Mono size={12.5} color={C.text} style={{ fontFamily: F.monoSemibold }}>{amount.total}</Mono>
        </View>
      </Card>
      <View style={{ marginTop: 'auto', paddingHorizontal: 22, paddingBottom: 36 }}>
        <Body size={12} color={C.sub} style={{ textAlign: 'center' }}>Enter PIN to send</Body>
        <View style={{ marginTop: 14, marginBottom: 18 }}>
          <PinDots filled={pin.length} />
        </View>
        <Keypad onKey={handleKey} />
      </View>
    </View>
  );
}
