import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { C, F } from '../theme/tokens';
import { Screen, Card, MetallicButton, GhostButton, Label, Mono, Body, Display, Spark, BackChevron } from '../components/ui';
import { leaders } from '../data/mock';

const myCopy = { name: 'Amara Okafor', sub: '$250 allocated · 3 positions mirrored', pnl: '+$11.20', pct: '+4.5%' };

// Design 3a: trade space — trading balance, my copies, leader directory (Worldstreet).
export default function TradeSpaceScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 }}>
        <Pressable onPress={onBack} hitSlop={10}><BackChevron /></Pressable>
        <View style={{ width: 30, height: 30, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={15} height={15} viewBox='0 0 24 24'>
            <Path d='M3.5 17 9 11.5l4 3L20.5 7' stroke={C.accent} strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' fill='none' />
            <Path d='M15.5 7h5v5' stroke={C.accent} strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' fill='none' />
          </Svg>
        </View>
        <Display size={20}>Copy trading</Display>
        <View style={{ flex: 1 }} />
        <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Body size={10} color={C.dim}>Worldstreet</Body>
        </View>
      </View>
      <View style={{ marginTop: 24 }}>
        <Body size={11.5} color={C.dim}>Trading balance</Body>
        <Display size={46} style={{ marginTop: 6 }}>$261<Display size={26} color={C.dim}>.20</Display></Display>
        <Mono size={12} color={C.up} style={{ marginTop: 8 }}>+$11.20 all-time · ≈ ₦401,300</Mono>
      </View>
      <View style={{ marginTop: 16, flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><MetallicButton label='Top up' height={46} radius={14} size={13} /></View>
        <View style={{ flex: 1 }}><GhostButton label='Withdraw' /></View>
      </View>
      <Card style={{ marginTop: 16, borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15 }}>
        <Label style={{ fontSize: 9.5, color: C.accent }}>My copies · 1</Label>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Body size={13.5} semibold>{myCopy.name}</Body>
            <Body size={11} color={C.dim} style={{ marginTop: 2 }}>{myCopy.sub}</Body>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Mono size={13.5} color={C.up}>{myCopy.pnl}</Mono>
            <Body size={10.5} color={C.up} style={{ marginTop: 2 }}>{myCopy.pct}</Body>
          </View>
        </View>
      </Card>
      <View style={{ marginTop: 18 }}>
        <Label>Leaders</Label>
        {leaders.map((l, i) => (
          <View key={l.ini} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: i === leaders.length - 1 ? 0 : 1, borderBottomColor: C.hairline }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.display, fontSize: 14, color: C.accent }}>{l.ini}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Body size={14} semibold>{l.name}</Body>
                {l.risky ? (
                  <View style={{ backgroundColor: 'rgba(245,184,61,0.12)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: F.bodySemibold, fontSize: 9.5, color: C.amber }}>HIGH RISK</Text>
                  </View>
                ) : null}
              </View>
              <Body size={11} color={C.dim} style={{ marginTop: 2 }}>{l.handle} · Win {l.win} · DD {l.dd}</Body>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Mono size={14} color={C.up}>{l.pnl}</Mono>
              <View style={{ marginTop: 3 }}><Spark points={l.spark} color={l.up ? C.up : C.accent} /></View>
              <Body size={9.5} color={C.dim}>{l.copiers}</Body>
            </View>
          </View>
        ))}
      </View>
      <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 16 }}>Mirrors execute against your allocation with your risk caps.</Body>
      <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 6, marginBottom: 8 }}>Mirror top traders — powered by Worldstreet</Body>
    </Screen>
  );
}
