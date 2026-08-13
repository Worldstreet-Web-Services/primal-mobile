import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polyline, Path } from 'react-native-svg';
import { C, F } from '../theme/tokens';

export function Screen({ children, pad = 20 }: { children: React.ReactNode; pad?: number }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.canvas }} contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: 40 }}>
      {children}
    </ScrollView>
  );
}

export function Shine() {
  return <View pointerEvents='none' style={{ position: 'absolute', top: 0, left: 12, right: 12, height: 1, backgroundColor: 'rgba(255,255,255,0.18)' }} />;
}

export function Card({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 16, overflow: 'hidden' }, style]}>
      <Shine />
      {children}
    </View>
  );
}

export function MetallicButton({ label, onPress, height = 52, radius = 16, size = 15 }: { label: string; onPress?: () => void; height?: number; radius?: number; size?: number }) {
  return (
    <Pressable onPress={onPress} style={{ shadowColor: '#fff', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
      <LinearGradient colors={C.metal} style={{ height, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <View pointerEvents='none' style={{ position: 'absolute', top: 1, left: 10, right: 10, height: 1, backgroundColor: 'rgba(255,255,255,0.5)' }} />
        <Text style={{ color: C.ink, fontFamily: F.bodySemibold, fontSize: size }}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function GhostButton({ label, onPress, height = 46 }: { label: string; onPress?: () => void; height?: number }) {
  return (
    <Pressable onPress={onPress} style={{ height, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.text, fontFamily: F.bodyMedium, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[{ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.5, color: C.dim, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

export function Mono({ children, size = 12, color = C.silver, style }: { children: React.ReactNode; size?: number; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: F.mono, fontSize: size, color }, style]}>{children}</Text>;
}

export function Display({ children, size = 34, color = C.text, style }: { children: React.ReactNode; size?: number; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: F.display, fontSize: size, color, lineHeight: size * 1.05 }, style]}>{children}</Text>;
}

export function Body({ children, size = 13, color = C.text, semibold, style }: { children: React.ReactNode; size?: number; color?: string; semibold?: boolean; style?: TextStyle }) {
  return <Text style={[{ fontFamily: semibold ? F.bodySemibold : F.body, fontSize: size, color }, style]}>{children}</Text>;
}

export function BackChevron({ color = C.silver }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox='0 0 24 24'>
      <Path d='M14.5 5 8 12l6.5 7' stroke={color} strokeWidth={1.8} strokeLinecap='round' strokeLinejoin='round' fill='none' />
    </Svg>
  );
}

export function BackHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10 }}>
      <Pressable onPress={onBack} hitSlop={10}><BackChevron /></Pressable>
      <Display size={20}>{title}</Display>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function PulseDot({ color = C.amber, size = 6 }: { color?: string; size?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: v }} />;
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <View style={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
      <LinearGradient colors={['#7a7a7a', '#e8e8ea']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 6, width: (pct + '%') as any, borderRadius: 99 }} />
    </View>
  );
}

export function Spark({ points, color = C.accent }: { points: string; color?: string }) {
  return (
    <Svg width={64} height={20} viewBox='0 0 64 24' preserveAspectRatio='none'>
      <Polyline points={points} fill='none' stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function SegTabs({ tabs, active, onChange }: { tabs: string[]; active: number; onChange?: (i: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.canvas, borderRadius: 12, padding: 3 }}>
      {tabs.map((t, i) => (
        <Pressable key={t} onPress={() => onChange && onChange(i)} style={{ flex: 1 }}>
          {i === active ? (
            <LinearGradient colors={C.metal} style={{ paddingVertical: 8, borderRadius: 9, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.bodySemibold, fontSize: 12.5, color: C.ink }}>{t}</Text>
            </LinearGradient>
          ) : (
            <View style={{ paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ fontFamily: F.bodySemibold, fontSize: 12.5, color: C.sub }}>{t}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function PinDots({ filled }: { filled: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: i < filled ? '#e8e8ea' : 'rgba(199,204,209,0.22)' }} />
      ))}
    </View>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {KEYS.map((k, i) => (
        <Pressable key={i} disabled={!k} onPress={() => onKey(k)}
          style={{ width: '31%', flexGrow: 1, height: 56, borderRadius: 16, backgroundColor: k && k !== 'del' ? C.key : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.display, fontSize: 21, color: k === 'del' ? C.silver : C.text }}>{k === 'del' ? '\u232b' : k}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TxRow({ icon, dir, title, sub, amount, status, credit, pending, last }: { icon: string; dir?: string; title: string; sub: string; amount: string; status?: string; credit?: boolean; pending?: boolean; last?: boolean }) {
  const inFlow = dir === 'in';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.hairline }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: inFlow ? C.upBg : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 15, color: inFlow ? C.up : C.silver }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Body size={13.5} semibold>{title}</Body>
        <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>{sub}</Body>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Mono size={13} color={credit ? C.up : C.text}>{amount}</Mono>
        {status ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {pending ? <PulseDot /> : null}
            <Body size={10.5} color={pending ? C.amber : C.dim}>{status}</Body>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: active ? C.accent : C.border, backgroundColor: active ? 'rgba(255,255,255,0.1)' : C.card }}>
      <Text style={{ fontFamily: F.bodySemibold, fontSize: 12, color: active ? '#e8e8ea' : C.silver }}>{label}</Text>
    </Pressable>
  );
}
