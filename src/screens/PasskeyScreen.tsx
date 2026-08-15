import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import Svg, { Path, Circle } from 'react-native-svg';
import { MetallicButton, Display, Body } from '../components/ui';

export default function PasskeyScreen({
  onEnable,
  onSkip,
  enabling = false,
  label = 'Face ID',
}: {
  onEnable?: () => void;
  onSkip?: () => void;
  enabling?: boolean;
  /** What this device actually offers — Face ID, Touch ID, Fingerprint. */
  label?: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22, paddingBottom: 30 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 12 }}>
        <View style={{ width: 92, height: 92, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={46} height={46} viewBox='0 0 24 24'>
            <Path d='M8 3.5H5.5A2 2 0 0 0 3.5 5.5V8M16 3.5h2.5a2 2 0 0 1 2 2V8M8 20.5H5.5a2 2 0 0 1-2-2V16M16 20.5h2.5a2 2 0 0 0 2-2V16M9 15c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4' stroke={C.accent} strokeWidth={1.6} strokeLinecap='round' fill='none' />
            <Circle cx={9} cy={10} r={0.9} fill={C.accent} />
            <Circle cx={15} cy={10} r={0.9} fill={C.accent} />
          </Svg>
        </View>
        <Display size={26}>Add a passkey</Display>
        <Body size={13.5} color={C.sub} style={{ textAlign: 'center', lineHeight: 22 }}>Unlock Primal and sign transactions with {label}. Your key is split across this device, Decane, and recovery — no one can sign without you.</Body>
      </View>
      <View style={{ gap: 10 }}>
        <MetallicButton label={`Enable ${label}`} onPress={onEnable} loading={enabling} />
        <Pressable onPress={enabling ? undefined : onSkip} style={{ height: 48, alignItems: 'center', justifyContent: 'center', opacity: enabling ? 0.45 : 1 }}>
          <Body size={14} color={C.sub}>Maybe later</Body>
        </Pressable>
        <Body size={11} color={C.dim} style={{ textAlign: 'center' }}>New devices need email step-up before money can leave.</Body>
      </View>
    </View>
  );
}
