import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import { Screen, BackHeader, Card, Label, Mono, Body } from '../components/ui';
import { user } from '../data/mock';

const evmShort = user.evm.slice(0, 6) + '…' + user.evm.slice(-4);
const solShort = user.sol.slice(0, 4) + '…' + user.sol.slice(-4);

const securityRows = [
  { title: 'Transaction PIN', sub: 'Required for money-out' },
  { title: 'Passkeys', sub: '2 devices · TEE-backed signing' },
  { title: 'Trusted devices', sub: 'iPhone 16 Pro — this device' },
  { title: 'Spend limits', sub: '₦500,000 / day · self-imposed' },
];

// Design 3f: profile — identity card, account details, security rows, freeze switch.
export default function ProfileScreen({ onBack }: { onBack?: () => void }) {
  const [frozen, setFrozen] = useState(false);
  return (
    <Screen>
      <BackHeader title='Profile' onBack={onBack} />
      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <LinearGradient colors={C.metal} style={{ width: 48, height: 48, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>{user.initial}</Text>
          </LinearGradient>
          <View>
            <Body size={15.5} semibold>{user.name}</Body>
            <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>{user.tag} · via KingsChat · joined Aug 2026</Body>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 14, marginBottom: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 }}>
          <Body size={12} color={C.sub}>Account number</Body>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Mono size={12} color={C.text}>{user.va} · Rubies</Mono>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Body size={10} color={C.accent} semibold>Copy</Body>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 }}>
          <Body size={12} color={C.sub}>Wallets</Body>
          <Mono size={12}>{evmShort} · {solShort}</Mono>
        </View>
      </Card>
      <Label style={{ marginTop: 18 }}>Security</Label>
      <Card style={{ marginTop: 8, paddingVertical: 2, paddingHorizontal: 16 }}>
        {securityRows.map((r) => (
          <View key={r.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <Body size={13.5} semibold>{r.title}</Body>
              <Body size={10.5} color={C.dim} style={{ marginTop: 2 }}>{r.sub}</Body>
            </View>
            <Body size={15} color={C.dim}>›</Body>
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 }}>
          <View style={{ flex: 1 }}>
            <Body size={13.5} semibold>Freeze money-out</Body>
            <Body size={10.5} color={C.dim} style={{ marginTop: 2 }}>Panic switch — blocks every money-out route instantly</Body>
          </View>
          <Pressable onPress={() => setFrozen(!frozen)}
            style={{ width: 44, height: 26, borderRadius: 14, backgroundColor: frozen ? C.amber : 'rgba(255,255,255,0.2)', padding: 2, alignItems: frozen ? 'flex-end' : 'flex-start' }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: C.text }} />
          </Pressable>
        </View>
      </Card>
      <Body size={13} color={C.down} style={{ textAlign: 'center', marginTop: 16, fontFamily: F.bodyMedium }}>Sign out</Body>
    </Screen>
  );
}
