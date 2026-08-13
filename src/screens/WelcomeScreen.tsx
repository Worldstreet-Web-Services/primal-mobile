import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, F } from '../theme/tokens';
import { MetallicButton, GhostButton, Body, Display } from '../components/ui';

export default function WelcomeScreen({ onLogin }: { onLogin?: (method: string) => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22, paddingBottom: 30 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <LinearGradient colors={C.metal} style={{ width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.displayBold, fontSize: 32, color: C.ink }}>P</Text>
        </LinearGradient>
        <Display size={36}>Primal</Display>
        <Body size={14} color={C.sub} style={{ textAlign: 'center', lineHeight: 21 }}>One account. One balance.{'\n'}Every rail.</Body>
      </View>
      <View style={{ gap: 10 }}>
        <MetallicButton label='Continue with KingsChat' onPress={() => onLogin && onLogin('kingschat')} />
        <GhostButton height={52} label='Continue with Google' onPress={() => onLogin && onLogin('google')} />
        <GhostButton height={52} label='Continue with email' onPress={() => onLogin && onLogin('email')} />
        <Body size={11} color={C.dim} style={{ textAlign: 'center', lineHeight: 17, marginTop: 8 }}>
          Non-custodial ETH + SOL wallets · keys split three ways{'\n'}Signed in a secure enclave, unlocked by your passkey
        </Body>
      </View>
    </View>
  );
}
