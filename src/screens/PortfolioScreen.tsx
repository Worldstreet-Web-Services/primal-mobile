import React from 'react';
import { View, Text } from 'react-native';
import { C, F } from '../theme/tokens';
import { Screen, Label, Mono, Body, Display, AmountText, MetallicButton, GhostButton } from '../components/ui';

// Portfolio tab — the HOLD view of buy-and-hold: total value, how it splits,
// every holding, then the two ways money moves (buy more / withdraw).
const total = {
  usd: '$18,585.60',
  naira: '≈ ₦28,715,000',
  gain: '+$212.40 all-time',
};

const allocation = [
  { key: 'Fiat', pct: 45, color: C.silver },
  { key: 'Crypto', pct: 30, color: C.up },
  { key: 'Trading', pct: 15, color: C.accent },
  { key: 'Kash', pct: 10, color: C.amber },
];

type Holding = { sym: string; name: string; qty: string; usd: string; delta?: string };
const holdings: Holding[] = [
  { sym: '₦', name: 'Fiat', qty: '₦482,650.00', usd: '$312.40' },
  { sym: 'Ξ', name: 'ETH', qty: '0.031 ETH', usd: '$98.10', delta: '+2.1%' },
  { sym: '◎', name: 'SOL', qty: '0.62 SOL', usd: '$84.30', delta: '-0.8%' },
  { sym: '$', name: 'USDC', qty: '130.00 · Base', usd: '$130.00' },
  { sym: '⇄', name: 'Trading balance', qty: 'Copy trading', usd: '$261.20', delta: '+4.5%' },
  { sym: '◆', name: 'Kash', qty: '128.40 KSH', usd: '$173.84' },
];

export default function PortfolioScreen({
  onBuy,
  onWithdraw,
  bottom = 130,
}: {
  onBuy?: () => void;
  onWithdraw?: () => void;
  /** Tail space — raise it on tab screens so the floating bar can't cover content. */
  bottom?: number;
}) {
  return (
    <Screen bottom={bottom}>
      {/* Tab root, so a plain title — no back chevron. */}
      <Display size={20} style={{ paddingTop: 10 }}>Portfolio</Display>

      <View style={{ marginTop: 26 }}>
        <Body size={11.5} color={C.dim}>Total value</Body>
        <AmountText value={total.usd} size={40} style={{ marginTop: 6 }} />
        <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
          {total.naira} · <Mono size={12} color={C.up}>{total.gain}</Mono>
        </Mono>
      </View>

      <View style={{ marginTop: 20 }}>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
          {allocation.map((a) => (
            <View key={a.key} style={{ flex: a.pct, backgroundColor: a.color }} />
          ))}
        </View>
        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {allocation.map((a) => (
            <View key={a.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: a.color }} />
              <Mono size={10.5} color={C.sub}>{a.key} {a.pct}%</Mono>
            </View>
          ))}
        </View>
      </View>

      <Label style={{ marginTop: 24 }}>Holdings</Label>
      {holdings.map((h, i) => (
        <View
          key={h.name}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: i === holdings.length - 1 ? 0 : 1,
            borderBottomColor: C.hairline,
          }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.mono, fontSize: 14, color: C.silver }}>{h.sym}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Body size={13.5} semibold>{h.name}</Body>
            <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>{h.qty}</Body>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Mono size={13} color={C.text}>{h.usd}</Mono>
            {h.delta ? (
              <Mono size={11} color={h.delta.startsWith('-') ? C.down : C.up} style={{ marginTop: 2 }}>{h.delta}</Mono>
            ) : null}
          </View>
        </View>
      ))}

      <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><MetallicButton label='Buy more' height={50} radius={14} size={13.5} onPress={onBuy} /></View>
        <View style={{ flex: 1 }}><GhostButton label='Withdraw' height={50} onPress={onWithdraw} /></View>
      </View>
    </Screen>
  );
}
