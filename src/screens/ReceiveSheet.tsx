import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C, F } from '../theme/tokens';
import { Display, Body, Mono, MetallicButton, GhostButton, SegTabs, Chip } from '../components/ui';
import { user, networks } from '../data/mock';

// Designs 4c + 4d: receive sheet — bank VA with copy affordance / crypto network picker.
function QrBox({ size, label }: { size: number; label: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 16, alignSelf: 'center', backgroundColor: C.key, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(199,204,209,0.3)', alignItems: 'center', justifyContent: 'center' }}>
      <Mono size={10} color={C.dim}>{label}</Mono>
    </View>
  );
}

export default function ReceiveSheet({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState(0);
  const [net, setNet] = useState(0);
  const nw = networks[net];
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, justifyContent: 'flex-end' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={{ backgroundColor: C.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: 'rgba(199,204,209,0.16)', paddingTop: 12, paddingHorizontal: 22, paddingBottom: 42 }}>
        <View style={{ width: 36, height: 4, borderRadius: 3, backgroundColor: 'rgba(199,204,209,0.3)', alignSelf: 'center', marginBottom: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Display size={21}>Receive</Display>
          <Pressable onPress={onClose} hitSlop={8} style={{ width: 30, height: 30, borderRadius: 16, backgroundColor: '#1A1D22', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.sub, fontSize: 14 }}>✕</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 14 }}>
          <SegTabs tabs={['Bank transfer', 'Crypto']} active={tab} onChange={setTab} />
        </View>
        {tab === 0 ? (
          <View>
            <View style={{ marginTop: 20 }}><QrBox size={150} label='QR · account details' /></View>
            <Mono size={26} color={C.text} style={{ fontFamily: F.monoSemibold, letterSpacing: 3, textAlign: 'center', marginTop: 18 }}>{user.va}</Mono>
            <Body size={12.5} color={C.sub} style={{ textAlign: 'center', marginTop: 6 }}>{user.bank} · {user.name}</Body>
            <View style={{ marginTop: 18, flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><MetallicButton label='Copy number' height={48} radius={14} size={13.5} /></View>
              <View style={{ flex: 1 }}><GhostButton label='Share details' height={48} /></View>
            </View>
            <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 14, lineHeight: 17.5 }}>Anyone can bank-transfer to this number.{'\n'}Funds land as your Paradigm balance — usually under 10s.</Body>
          </View>
        ) : (
          <View>
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
              {networks.map((n, i) => (
                <Chip key={n.key} label={n.label} active={i === net} onPress={() => setNet(i)} />
              ))}
            </View>
            <Body size={11} color={C.dim} style={{ marginTop: 8 }}>{nw.note}</Body>
            <View style={{ marginTop: 16 }}><QrBox size={130} label={'QR · ' + nw.label + ' address'} /></View>
            <Mono size={13} color={C.silver} style={{ textAlign: 'center', marginTop: 16, maxWidth: 280, alignSelf: 'center', lineHeight: 21 }}>{nw.addr}</Mono>
            <View style={{ marginTop: 14, alignSelf: 'center', backgroundColor: C.upBg, borderWidth: 1, borderColor: 'rgba(124,231,176,0.35)', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 12 }}>
              <Body size={11} color={C.up} semibold>↓ Auto-converts to your ₦ balance</Body>
            </View>
            <View style={{ marginTop: 16 }}><MetallicButton label='Copy address' height={48} radius={14} size={13.5} /></View>
            <Body size={11} color={C.dim} style={{ textAlign: 'center', marginTop: 14, lineHeight: 17.5 }}>Balance credits the moment conversion clears — before settlement.{'\n'}Failed conversions refund on-chain and always show in Activity.</Body>
          </View>
        )}
      </View>
    </View>
  );
}
