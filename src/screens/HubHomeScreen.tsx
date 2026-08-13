import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import { Screen, Card, Label, Mono, Body, Shine } from '../components/ui';
import { hubTiles, user } from '../data/mock';

// Design 2a: hub home — tiles with per-space balances, metallic system.
export default function HubHomeScreen({ onOpen }: { onOpen?: (space: string) => void }) {
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 6 }}>
        <View style={{ width: 38, height: 38, borderRadius: 20, backgroundColor: C.key, borderWidth: 1.5, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.display, fontSize: 16, color: C.text }}>{user.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Body size={11} color={C.dim}>Good morning</Body>
          <Body size={14.5} semibold>Denga <Body size={14.5} color={C.dim}>· {user.tag}</Body></Body>
        </View>
      </View>
      <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
        <Label>Across Primal</Label>
        <Mono size={12.5}>≈ ₦748,300 · $487.10</Mono>
      </View>
      <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
        {hubTiles.map((t) => (
          <Pressable key={t.key} onPress={() => onOpen && onOpen(t.key)} style={{ width: '48%', flexGrow: 1 }}>
            <Card style={{ padding: 15, borderColor: t.badge ? C.borderStrong : C.border }}>
              {t.badge ? (
                <View style={{ position: 'absolute', top: 12, right: 12 }}>
                  <LinearGradient colors={C.metal} style={{ borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: F.bodySemibold, fontSize: 9, color: C.ink }}>{t.badge}</Text>
                  </LinearGradient>
                </View>
              ) : null}
              <View style={{ width: 34, height: 34, borderRadius: 18, backgroundColor: t.key === 'fiat' ? C.upBg : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Mono size={13} color={t.key === 'fiat' ? C.up : C.accent}>{t.key === 'fiat' ? '₦' : t.key === 'games' ? '★' : '◇'}</Mono>
              </View>
              <Body size={13} semibold style={{ marginTop: 12 }}>{t.title}</Body>
              <Mono size={15} color={C.text} style={{ marginTop: 6, fontFamily: F.monoSemibold }}>
                {t.value}{t.delta ? <Mono size={10.5} color={C.up}>  {t.delta}</Mono> : null}
              </Mono>
              <Body size={10} color={t.warn ? C.amber : C.dim} style={{ marginTop: 4 }}>{t.warn || t.sub}</Body>
            </Card>
          </Pressable>
        ))}
      </View>
      <Card style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 }}>
        <Mono size={15} color={C.accent}>◆</Mono>
        <Body size={12} color={C.sub} style={{ flex: 1 }}><Body size={12} color={C.accent} semibold>Auto-earn</Body> · 1,240 pts this week · ≈ $16.90</Body>
        <Body size={14} color={C.dim}>›</Body>
      </Card>
      <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 20 }}>Move money between spaces anytime — one ledger underneath.</Body>
    </Screen>
  );
}
