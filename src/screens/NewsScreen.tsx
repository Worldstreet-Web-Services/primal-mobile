import React from 'react';
import { View } from 'react-native';
import { C } from '../theme/tokens';
import { Screen, BackHeader, Card, Label, Mono, Body, Display } from '../components/ui';

// The News — curated daily briefs across the Paradigm ecosystem.
const featured = {
  tag: 'MARKETS',
  headline: 'Naira steadies as remit corridors reopen',
  sub: 'Parallel-market spreads narrowed to a three-month low after two corridor partners resumed same-day settlement over the weekend.',
  meta: '5 min read · 08:40',
};

const articles = [
  { tag: 'KASH', headline: 'KSH settlement price prints $1.354 at the Saturday mint', time: '07:55' },
  { tag: 'CRYPTO', headline: 'USDC flows on Base hit a weekly high as fees stay under a cent', time: '07:20' },
  { tag: 'PARADIGM', headline: 'Last Man pot clears ₦4.2m — the biggest round on record', time: '06:48' },
  { tag: 'MARKETS', headline: 'Copy-trading leaders rotate into gold pairs ahead of CPI', time: '06:10' },
  { tag: 'CRYPTO', headline: 'BTC holds $112k as ETF inflows stretch to a ninth straight day', time: '05:32' },
];

function TagPill({ tag }: { tag: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: C.key, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 }}>
      <Mono size={9} color={C.silver} style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>{tag}</Mono>
    </View>
  );
}

export default function NewsScreen({ onBack }: { onBack?: () => void }) {
  return (
    <Screen>
      <BackHeader title='The News' onBack={onBack} />
      <Card style={{ marginTop: 18, borderRadius: 22, padding: 18 }}>
        <TagPill tag={featured.tag} />
        <Display size={18} style={{ marginTop: 12, lineHeight: 24 }}>{featured.headline}</Display>
        <Body size={12} color={C.dim} style={{ marginTop: 8, lineHeight: 18 }}>{featured.sub}</Body>
        <Mono size={10} color={C.dim} style={{ marginTop: 12 }}>{featured.meta}</Mono>
      </Card>
      <View style={{ marginTop: 22 }}>
        <Label>Today</Label>
        {articles.map((a, i) => (
          <View key={a.headline} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: i === articles.length - 1 ? 0 : 1, borderBottomColor: C.hairline }}>
            <View style={{ flex: 1 }}>
              <TagPill tag={a.tag} />
              <Body size={13.5} semibold style={{ marginTop: 7, lineHeight: 19 }}>{a.headline}</Body>
            </View>
            <Mono size={10} color={C.dim}>{a.time}</Mono>
          </View>
        ))}
      </View>
      <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 20, marginBottom: 8 }}>Curated daily — no doomscrolling.</Body>
    </Screen>
  );
}
