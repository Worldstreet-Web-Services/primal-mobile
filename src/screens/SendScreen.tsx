import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { C, F } from '../theme/tokens';
import { Screen, BackHeader, MetallicButton, Card, Label, Mono, Body, Display, Keypad, SegTabs } from '../components/ui';

// Design 4d: fiat send — pick a recipient (@tag P2P or bank), then punch in the amount.
type Recipient = { title: string; sub: string; initials: string; internal?: boolean };

const tagRecipients: Recipient[] = [
  { title: 'Tobi Adeyemi', sub: '@tobi', initials: 'TA', internal: true },
  { title: 'Amara Okafor', sub: '@amara', initials: 'AO', internal: true },
  { title: 'Kofi Mensah', sub: '@kofi', initials: 'KM', internal: true },
];

const bankRecipient: Recipient = { title: 'ADEBAYO KEHINDE', sub: 'GTBank · 0123 456 789', initials: 'AK' };

const balance = '₦482,650.00';
const RATE = 1545; // ₦ per $ — mock, matches the fiat space subline.
const MAX_DIGITS = 7;

const fmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function usdApprox(digits: string) {
  const n = parseInt(digits || '0', 10);
  const usd = n / RATE;
  const whole = Math.floor(usd);
  const cents = String(Math.round((usd - whole) * 100)).padStart(2, '0');
  return `≈ $${fmt(String(whole))}.${cents} USD`;
}

function Avatar({ initials, dim }: { initials: string; dim?: boolean }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 21, backgroundColor: dim ? 'rgba(255,255,255,0.08)' : C.upBg, alignItems: 'center', justifyContent: 'center' }}>
      <Mono size={13} color={dim ? C.silver : C.up} style={{ fontFamily: F.monoSemibold }}>{initials}</Mono>
    </View>
  );
}

function RecipientRow({ r, onPress, last }: { r: Recipient; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.hairline }}>
      <Avatar initials={r.initials} dim={!r.internal} />
      <View style={{ flex: 1 }}>
        <Body size={13.5} semibold>{r.title}</Body>
        <Mono size={11.5} color={C.sub} style={{ marginTop: 2 }}>{r.sub}</Mono>
      </View>
      {r.internal ? (
        <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(124,231,176,0.4)', backgroundColor: C.upBg }}>
          <Body size={9.5} color={C.up} semibold>Paradigm</Body>
        </View>
      ) : (
        <Body size={10} color={C.up} semibold>Name enquiry ✓</Body>
      )}
    </Pressable>
  );
}

export default function SendScreen({ onBack, onContinue }: { onBack?: () => void; onContinue?: () => void }) {
  const [step, setStep] = useState<'recipient' | 'amount'>('recipient');
  const [tab, setTab] = useState(0);
  const [recipient, setRecipient] = useState<Recipient>(tagRecipients[0]);
  const [digits, setDigits] = useState('');

  const pick = (r: Recipient) => {
    setRecipient(r);
    setStep('amount');
  };

  const handleKey = (k: string) => {
    if (k === 'del') {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    if (digits === '' && k === '0') return;
    setDigits(digits + k);
  };

  if (step === 'recipient') {
    return (
      <Screen>
        <BackHeader title='Send' onBack={onBack} />
        <View style={{ marginTop: 20 }}>
          <SegTabs tabs={['@tag', 'Bank account']} active={tab} onChange={setTab} />
        </View>
        {tab === 0 ? (
          <View style={{ marginTop: 20 }}>
            <Label>Recent</Label>
            <Card style={{ marginTop: 10, paddingVertical: 4 }}>
              {tagRecipients.map((r, i) => (
                <RecipientRow key={r.sub} r={r} onPress={() => pick(r)} last={i === tagRecipients.length - 1} />
              ))}
            </Card>
            <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 14 }}>@tag transfers land instantly · free between Paradigm accounts</Body>
          </View>
        ) : (
          <View style={{ marginTop: 20 }}>
            <Label>Bank transfer</Label>
            <Card style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Mono size={12} style={{ fontFamily: F.monoSemibold }}>GT</Mono>
              </View>
              <View style={{ flex: 1 }}>
                <Body size={13.5} semibold>GTBank</Body>
                <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>Tap to change bank</Body>
              </View>
              <Body size={10} color={C.accent} semibold>Change</Body>
            </Card>
            <Card style={{ marginTop: 10, paddingVertical: 14 }}>
              <Label style={{ letterSpacing: 1.2 }}>Account number</Label>
              <Mono size={18} color={C.text} style={{ marginTop: 8 }}>0123 456 789</Mono>
              <Body size={11} color={C.dim} style={{ marginTop: 6 }}>10-digit NUBAN · name enquiry runs automatically</Body>
            </Card>
            <View style={{ marginTop: 16 }}>
              <Label>Resolved</Label>
              <Card style={{ marginTop: 10, paddingVertical: 4, borderColor: 'rgba(124,231,176,0.4)' }}>
                <RecipientRow r={bankRecipient} onPress={() => pick(bankRecipient)} last />
              </Card>
            </View>
          </View>
        )}
      </Screen>
    );
  }

  const canContinue = digits !== '';

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <BackHeader title='Send' onBack={() => setStep('recipient')} />
      </View>
      <Card style={{ marginTop: 16, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Avatar initials={recipient.initials} dim={!recipient.internal} />
        <View style={{ flex: 1 }}>
          <Body size={13.5} semibold>{recipient.title}</Body>
          <Mono size={11.5} color={C.sub} style={{ marginTop: 2 }}>{recipient.sub}</Mono>
        </View>
        {recipient.internal ? <Body size={10} color={C.up} semibold>Paradigm</Body> : null}
      </Card>
      <View style={{ marginTop: 28, alignItems: 'center' }}>
        <Body size={11.5} color={C.dim}>You're sending</Body>
        <Display size={46} style={{ marginTop: 6 }} color={digits ? C.text : C.dim}>₦{fmt(digits || '0')}</Display>
        <Mono size={12} color={C.sub} style={{ marginTop: 6 }}>{usdApprox(digits)}</Mono>
        <Body size={11} color={C.dim} style={{ marginTop: 10 }}>Balance {balance} · fee shown at confirm</Body>
      </View>
      <View style={{ marginTop: 'auto', paddingHorizontal: 22, paddingBottom: 36 }}>
        <Keypad onKey={handleKey} />
        <View style={{ marginTop: 18, opacity: canContinue ? 1 : 0.4 }} pointerEvents={canContinue ? 'auto' : 'none'}>
          <MetallicButton label='Continue' onPress={onContinue} />
        </View>
      </View>
    </View>
  );
}
