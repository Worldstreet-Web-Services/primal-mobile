import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { C, F } from '../theme/tokens';
import { MetallicButton, GhostButton, Body, Display } from '../components/ui';

export default function WelcomeScreen({ onLogin }: { onLogin?: (method: string) => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22, paddingBottom: 30 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <View style={{ shadowColor: '#F5C842', shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: 108, height: 108, borderRadius: 28 }}
            contentFit='cover'
          />
        </View>
        <Display size={36}>Paradigm</Display>
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
