import React from 'react';
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { C } from '../theme/tokens';
import { Screen, BackChevron, Card, Display, Body, Mono, GhostButton, PulseDot } from '../components/ui';

// Design 4f: cross-border — provider-priced quote + status timeline.
type StageState = 'done' | 'active' | 'todo';
type Stage = { title: string; sub: string; state: StageState; link?: 'done' | 'toAmber' | 'idle' };

const stages: Stage[] = [
  { title: 'Quote locked', sub: '14:02 · spread baked into rate', state: 'done', link: 'done' },
  { title: '₦ debited', sub: '14:02 · idempotency-keyed', state: 'done', link: 'toAmber' },
  { title: 'Settling · USDC on Base', sub: 'Usually under 2 minutes', state: 'active', link: 'idle' },
  { title: 'Paid out · Stanbic GH', sub: 'Kofi gets an alert', state: 'todo' },
];

function StageNode({ state }: { state: StageState }) {
  if (state === 'done') {
    return (
      <LinearGradient colors={C.metal} style={{ width: 22, height: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={12} height={12} viewBox='0 0 24 24'>
          <Path d='m5 12.5 4.5 4.5L19 7.5' stroke={C.canvas} strokeWidth={3} strokeLinecap='round' strokeLinejoin='round' fill='none' />
        </Svg>
      </LinearGradient>
    );
  }
  if (state === 'active') {
    return (
      <View style={{ width: 22, height: 22, borderRadius: 12, borderWidth: 2, borderColor: C.amber, alignItems: 'center', justifyContent: 'center' }}>
        <PulseDot color={C.amber} size={8} />
      </View>
    );
  }
  return <View style={{ width: 22, height: 22, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(199,204,209,0.25)' }} />;
}

export default function CrossBorderScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        <Pressable onPress={onBack} hitSlop={10}><BackChevron /></Pressable>
        <View>
          <Display size={20}>To Ghana</Display>
          <Mono size={10.5} color={C.dim} style={{ marginTop: 1 }}>NGN → GHS · WORLDSTREET RAIL</Mono>
        </View>
      </View>
      <View style={{ marginTop: 24, alignItems: 'center' }}>
        <Body size={11.5} color={C.dim}>Kofi receives</Body>
        <Display size={42} style={{ marginTop: 6 }}>GH₵41,208<Display size={24} color={C.dim}>.50</Display></Display>
        <Mono size={12} color={C.sub} style={{ marginTop: 4 }}>You sent ₦500,000.00 · ≈ $326.10</Mono>
      </View>
      <Card style={{ marginTop: 20, paddingVertical: 4, paddingHorizontal: 16, borderRadius: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.hairline }}>
          <Body size={12.5} color={C.sub}>Rate</Body>
          <Mono size={12.5} color={C.text}>1 NGN → 0.08242 GHS</Mono>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.hairline }}>
          <Body size={12.5} color={C.sub}>Fee</Body>
          <Mono size={12.5} color={C.text}>₦1,250.00 <Mono size={12.5} color={C.dim}>· in quote</Mono></Mono>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 }}>
          <Body size={12.5} color={C.sub}>Recipient</Body>
          <Body size={12.5}>Kofi Mensah · Stanbic GH</Body>
        </View>
      </Card>
      <View style={{ marginTop: 22, paddingHorizontal: 6 }}>
        {stages.map((s, i) => (
          <View key={s.title} style={{ flexDirection: 'row', gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <StageNode state={s.state} />
              {i < stages.length - 1 ? (
                s.link === 'toAmber' ? (
                  <LinearGradient colors={['#e8e8ea', C.amber]} style={{ width: 2, flex: 1 }} />
                ) : (
                  <View style={{ width: 2, flex: 1, backgroundColor: s.link === 'done' ? '#e8e8ea' : 'rgba(199,204,209,0.15)' }} />
                )
              ) : null}
            </View>
            <View style={{ flex: 1, paddingBottom: i < stages.length - 1 ? 22 : 0 }}>
              <Body size={13.5} semibold color={s.state === 'active' ? C.amber : s.state === 'todo' ? C.dim : C.text}>{s.title}</Body>
              <Body size={11} color={C.dim} style={{ marginTop: 2 }}>{s.sub}</Body>
            </View>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 24 }}>
        <GhostButton label='Share receipt' height={48} />
        <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 12 }}>Pricing comes from the provider quote — Primal never adds a client-side fee.</Body>
      </View>
    </Screen>
  );
}
