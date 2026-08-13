import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import { Screen, Card, MetallicButton, Mono, Body, Display, BackChevron, PulseDot } from '../components/ui';

// Design 3c: games space — own balance, claim banner, flagship Last Man card, shelf.
const flagshipStats = [
  { k: 'POT', v: '$1,240' },
  { k: 'CLOCK', v: '04:32', amber: true },
  { k: 'LAST MAN', v: '@tobi' },
];

export default function GamesSpaceScreen({ onBack, onOpenGame }: { onBack?: () => void; onOpenGame?: (slug: string) => void }) {
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        <Pressable onPress={onBack} hitSlop={10}><BackChevron /></Pressable>
        <View style={{ width: 30, height: 30, borderRadius: 16, backgroundColor: 'rgba(245,184,61,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: C.amber }}>★</Text>
        </View>
        <Display size={20}>Games</Display>
        <View style={{ flex: 1 }} />
        <Mono size={12}>$85.00</Mono>
      </View>
      <View style={{ marginTop: 14, shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        <LinearGradient colors={C.metal} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15, overflow: 'hidden' }}>
          <View pointerEvents='none' style={{ position: 'absolute', top: 1, left: 10, right: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
          <Text style={{ fontSize: 15, color: C.ink }}>★</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodySemibold, fontSize: 13, color: C.ink }}>You won Round #62 — $920</Text>
            <Text style={{ fontFamily: F.body, fontSize: 10.5, color: 'rgba(10,11,13,0.6)', marginTop: 1 }}>Winnings are claim-based, not auto-credited</Text>
          </View>
          <View style={{ backgroundColor: C.ink, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 }}>
            <Text style={{ fontFamily: F.bodySemibold, fontSize: 12, color: '#e8e8ea' }}>Claim</Text>
          </View>
        </LinearGradient>
      </View>
      <Pressable onPress={() => onOpenGame && onOpenGame('last-man')} style={{ marginTop: 14 }}>
        <Card style={{ borderRadius: 24, padding: 20, borderColor: C.borderStrong }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Mono size={10} color={C.accent} style={{ letterSpacing: 2 }}>FLAGSHIP · ROUND #63</Mono>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <PulseDot />
              <Body size={10} color={C.amber}>LIVE</Body>
            </View>
          </View>
          <Display size={26} style={{ marginTop: 12, lineHeight: 30 }}>{'The Last Man\nStanding'}</Display>
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 22 }}>
            {flagshipStats.map((s) => (
              <View key={s.k}>
                <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1 }}>{s.k}</Mono>
                <Mono size={16} color={s.amber ? C.amber : C.text} style={{ marginTop: 3, fontFamily: F.monoSemibold }}>{s.v}</Mono>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 16 }}>
            <MetallicButton label='Enter · $50' height={48} radius={14} size={14} onPress={() => onOpenGame && onOpenGame('last-man')} />
          </View>
          <Body size={10.5} color={C.dim} style={{ marginTop: 10 }}>Pay in, take the lead, reset the clock. Outlast everyone — the pot is yours.</Body>
        </Card>
      </Pressable>
      <View style={{ marginTop: 14, flexDirection: 'row', gap: 11 }}>
        <Card style={{ flex: 1, borderRadius: 18, padding: 16 }}>
          <Text style={{ fontSize: 26, color: C.accent, lineHeight: 28 }}>♞</Text>
          <Body size={14} semibold style={{ marginTop: 10 }}>Chess</Body>
          <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.up }} />
            <Body size={10.5} color={C.up}>212 playing</Body>
          </View>
        </Card>
        <Card style={{ flex: 1, borderRadius: 18, padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            <View style={{ width: 22, height: 22, borderRadius: 12, backgroundColor: '#e8e8ea' }} />
            <View style={{ width: 22, height: 22, borderRadius: 12, backgroundColor: '#7a7a7a' }} />
          </View>
          <Body size={14} semibold style={{ marginTop: 10 }}>Checkers</Body>
          <View style={{ marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.up }} />
            <Body size={10.5} color={C.up}>96 playing</Body>
          </View>
        </Card>
      </View>
      <View style={{ marginTop: 12, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', padding: 14 }}>
        <Body size={11.5} color={C.dim} style={{ textAlign: 'center' }}>More games land on this shelf soon</Body>
      </View>
      <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 22 }}>Plays are on-chain from your crypto balance · signed with Face ID</Body>
    </Screen>
  );
}
