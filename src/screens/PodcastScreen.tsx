import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../theme/tokens';
import { Screen, BackHeader, Card, Label, Mono, Body, Display, MetallicButton, GhostButton } from '../components/ui';

// Podcast space — featured episode up top, back-catalog rows, subscribe strip.
const featured = {
  kicker: 'LATEST · EP 12',
  title: 'The optimistic fill, explained',
  sub: 'Why deposits land before settlement · 24 min',
};
const episodes = [
  { title: 'Reading the market pulse', sub: 'EP 11 · 18 min · Aug 8', duration: '18:24' },
  { title: 'Kash points, settled weekly', sub: 'EP 10 · 21 min · Aug 1', duration: '21:07' },
  { title: 'Copy-trading without the guesswork', sub: 'EP 9 · 26 min · Jul 25', duration: '26:41' },
  { title: 'Passkeys, PINs and your money', sub: 'EP 8 · 19 min · Jul 18', duration: '19:12' },
];

export default function PodcastScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <BackHeader title='Podcast' onBack={onBack} />
      <Card style={{ marginTop: 18, borderRadius: 22, padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: C.key, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, color: C.lime }}>▶</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Label>{featured.kicker}</Label>
            <Display size={17} style={{ marginTop: 6 }}>{featured.title}</Display>
          </View>
        </View>
        <Body size={12} color={C.sub} style={{ marginTop: 12 }}>{featured.sub}</Body>
        <View style={{ marginTop: 14 }}>
          <MetallicButton label='Play episode' height={48} radius={14} size={13.5} />
        </View>
      </Card>
      <View style={{ marginTop: 22 }}>
        <Label>Episodes</Label>
        {episodes.map((ep, i) => (
          <View key={ep.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: i === episodes.length - 1 ? 0 : 1, borderBottomColor: C.hairline }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, color: C.silver }}>▶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Body size={13.5} semibold>{ep.title}</Body>
              <Body size={11} color={C.dim} style={{ marginTop: 2 }}>{ep.sub}</Body>
            </View>
            <Mono size={12}>{ep.duration}</Mono>
          </View>
        ))}
      </View>
      <Card style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14 }}>
        <Body size={12.5} color={C.silver} style={{ flex: 1 }}>New episodes every Friday</Body>
        <View style={{ width: 108 }}><GhostButton label='Notify me' height={38} /></View>
      </Card>
    </Screen>
  );
}
