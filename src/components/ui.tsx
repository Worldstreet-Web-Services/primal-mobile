import {
  GlassView,
  isLiquidGlassAvailable,
  type GlassStyle,
} from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Path, Polyline } from "react-native-svg";
import { C, F } from "../theme/tokens";

export function Screen({
  children,
  pad = 20,
  top = 0,
  bottom = 40,
  center = false,
  showsScrollIndicator = false,
}: {
  children: React.ReactNode;
  pad?: number;
  /** Head space — set to the nav header's height when it overlays the scroll view. */
  top?: number;
  /** Tail space — raise it when something overlays the bottom of the screen. */
  bottom?: number;
  /** Center short content in the viewport — placeholders and empty states. */
  center?: boolean;
  showsScrollIndicator?: boolean;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.canvas }}
      contentContainerStyle={{
        paddingHorizontal: pad,
        paddingTop: top,
        paddingBottom: bottom,
        // flexGrow lets the container fill the viewport so centering has room,
        // while still growing past it once the content is taller.
        ...(center
          ? {
              flexGrow: 1,
              justifyContent: "center" as const,
              alignItems: "center" as const,
            }
          : null),
      }}
      showsVerticalScrollIndicator={showsScrollIndicator}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Pressable that dips slightly on touch. Every tappable surface on the home
 * screen wraps in this so the whole grid reacts the same way.
 */
export function PressableScale({
  children,
  onPress,
  style,
  scale = 0.97,
  disabled,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  scale?: number;
  disabled?: boolean;
  /** Set when the press target itself is the control, not something inside it. */
  accessibilityLabel?: string;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(v, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => to(scale)}
      onPressOut={() => to(1)}
      accessibilityRole={accessibilityLabel ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: v }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Resolved once per app run: whether the native Liquid Glass effect exists on
// this device (iOS 26+). Everywhere else translucency falls back to a flat
// see-through fill — no live blur, but still see-through.
export const LIQUID_GLASS = isLiquidGlassAvailable();

// The tint laid over the glass. Native sits on a live blur so it tints from the
// canvas value; the fallback has no blur to sit on, so it tints from the raised
// value — that step is what keeps a flat fill reading as a surface, not a hole.
const GLASS_TINT_RGB = "10,11,13";
const GLASS_FILL_RGB = "20,21,25";

/**
 * Translucent backing layer for floating chrome (tab bar, nav header, drawers).
 * Renders as an absolutely-filled sibling *behind* its container's children, so
 * the container itself must stay transparent.
 *
 * `effect` sets how hard the native blur bites — `clear` is the thin, barely
 * frosted one; `regular` is app chrome; `none` drops to a plain tint. `tintOpacity`
 * is the separate dial: 0 is untinted glass, 1 is an opaque slab. They compose,
 * so a clear blur under a heavy tint is a legitimate (if dark) surface.
 */
export function GlassSurface({
  radius = 0,
  bordered = true,
  effect = "regular",
  tintOpacity,
  style,
}: {
  radius?: number;
  bordered?: boolean;
  /** Blur strength on devices with native glass. Ignored on the fallback path. */
  effect?: GlassStyle;
  /** 0–1 darkening over the blur. Defaults to the shared chrome value. */
  tintOpacity?: number;
  style?: ViewStyle;
}) {
  const shape: ViewStyle = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius,
    borderWidth: bordered ? 1 : 0,
    borderColor: LIQUID_GLASS ? C.border : C.hairline,
  };

  if (LIQUID_GLASS) {
    return (
      <GlassView
        pointerEvents="none"
        glassEffectStyle={effect}
        colorScheme="dark"
        tintColor={
          tintOpacity === undefined
            ? C.glassTint
            : `rgba(${GLASS_TINT_RGB},${tintOpacity})`
        }
        style={[shape, style]}
      />
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[
        shape,
        {
          backgroundColor:
            tintOpacity === undefined
              ? C.glass
              : // No blur to hide behind here, so the same dial has to carry a
                // little more weight to keep type off the content underneath.
                `rgba(${GLASS_FILL_RGB},${Math.min(tintOpacity + 0.22, 1)})`,
        },
        style,
      ]}
    />
  );
}

/**
 * Pill radius — the default shape for every button in the system. Large enough
 * to fully round any button height we ship; override the `radius` prop on a
 * button when a squarer corner is deliberate.
 */
export const PILL = 999;

/**
 * Circular icon button — the quiet chrome action at the edge of a header row.
 * Takes the glyph as a child so it stays icon-agnostic.
 */
export function CircleAction({
  onPress,
  children,
  size = 40,
  badge = false,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  /** Unread marker in the top-right notch. */
  badge?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: size,
        height: size,
        borderRadius: PILL,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: C.brand,
            borderWidth: 1.5,
            borderColor: C.canvas,
          }}
        />
      ) : null}
    </Pressable>
  );
}

export function Shine() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 12,
        right: 12,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.28)",
      }}
    />
  );
}

export function Card({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 20,
          padding: 16,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Shine />
      {children}
    </View>
  );
}

export function MetallicButton({
  label,
  onPress,
  height = 52,
  radius = PILL,
  size = 15,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        // Glow picks up the fill — a white halo around gold reads as haze.
        shadowColor: C.brand,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <View
        style={{
          height,
          borderRadius: radius,
          backgroundColor: C.brand,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 1,
            left: 10,
            right: 10,
            height: 1,
            backgroundColor: "rgba(255,255,255,0.5)",
          }}
        />
        <Text
          style={{
            color: C.brandInk,
            fontFamily: F.bodySemibold,
            fontSize: size,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  height = 46,
  radius = PILL,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        height,
        borderRadius: radius,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: C.text, fontFamily: F.bodyMedium, fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1.5,
          color: C.dim,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Mono({
  children,
  size = 12,
  color = C.silver,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  return (
    <Text style={[{ fontFamily: F.mono, fontSize: size, color }, style]}>
      {children}
    </Text>
  );
}

export function Display({
  children,
  size = 34,
  color = C.text,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: F.display,
          fontSize: size,
          color,
          lineHeight: size * 1.05,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * A money figure with its decimals dropped a size, so the whole units carry
 * the glance. Splits on the last separator — the string is already formatted
 * upstream, since the UI never does the math.
 */
export function AmountText({
  value,
  size = 40,
  color = C.text,
  emphasizeCents = true,
  style,
}: {
  value: string;
  size?: number;
  color?: string;
  emphasizeCents?: boolean;
  style?: TextStyle;
}) {
  const dot = emphasizeCents ? value.lastIndexOf(".") : -1;

  if (dot === -1) {
    return (
      <Display size={size} color={color} style={style}>
        {value}
      </Display>
    );
  }

  return (
    <Display size={size} color={color} style={style}>
      {value.slice(0, dot)}
      <Text
        style={{ fontFamily: F.display, fontSize: size * 0.55, color: C.sub }}
      >
        {value.slice(dot)}
      </Text>
    </Display>
  );
}

export function Body({
  children,
  size = 13,
  color = C.text,
  semibold,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  semibold?: boolean;
  style?: TextStyle;
}) {
  return (
    <Text
      style={[
        {
          fontFamily: semibold ? F.bodySemibold : F.body,
          fontSize: size,
          color,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function BackChevron({ color = C.silver }: { color?: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 8 12l6.5 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function BackHeader({
  title,
  right,
  onBack,
}: {
  title: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingTop: 10,
      }}
    >
      <Pressable onPress={onBack} hitSlop={10}>
        <BackChevron />
      </Pressable>
      <Display size={20}>{title}</Display>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function PulseDot({
  color = C.amber,
  size = 6,
}: {
  color?: string;
  size?: number;
}) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: v,
      }}
    />
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  return (
    <View
      style={{
        height: 6,
        borderRadius: 99,
        backgroundColor: "rgba(255,255,255,0.1)",
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={["#7a7a7a", "#e8e8ea"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 6, width: (pct + "%") as any, borderRadius: 99 }}
      />
    </View>
  );
}

export function Spark({
  points,
  color = C.accent,
}: {
  points: string;
  color?: string;
}) {
  return (
    <Svg width={64} height={20} viewBox="0 0 64 24" preserveAspectRatio="none">
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export function SegTabs({
  tabs,
  active,
  onChange,
  tone = "metal",
}: {
  tabs: string[];
  active: number;
  onChange?: (i: number) => void;
  /** `metal` is the CTA-weight selector; `ghost` is the quiet one for chart ranges. */
  tone?: "metal" | "ghost";
}) {
  if (tone === "ghost") {
    return (
      <View style={{ flexDirection: "row", gap: 4 }}>
        {tabs.map((t, i) => (
          <Pressable
            key={t}
            onPress={() => onChange && onChange(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: i === active }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: i === active ? C.inset : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 1,
                color: i === active ? C.text : C.dim,
              }}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: C.canvas,
        borderRadius: 12,
        padding: 3,
      }}
    >
      {tabs.map((t, i) => (
        <Pressable
          key={t}
          onPress={() => onChange && onChange(i)}
          style={{ flex: 1 }}
        >
          {i === active ? (
            <LinearGradient
              colors={C.metal}
              style={{
                paddingVertical: 8,
                borderRadius: 9,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: F.bodySemibold,
                  fontSize: 12.5,
                  color: C.ink,
                }}
              >
                {t}
              </Text>
            </LinearGradient>
          ) : (
            <View style={{ paddingVertical: 8, alignItems: "center" }}>
              <Text
                style={{
                  fontFamily: F.bodySemibold,
                  fontSize: 12.5,
                  color: C.sub,
                }}
              >
                {t}
              </Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function PinDots({ filled }: { filled: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 15,
            height: 15,
            borderRadius: 8,
            backgroundColor: i < filled ? "#e8e8ea" : "rgba(199,204,209,0.22)",
          }}
        />
      ))}
    </View>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {KEYS.map((k, i) => (
        <Pressable
          key={i}
          disabled={!k}
          onPress={() => onKey(k)}
          style={{
            width: "31%",
            flexGrow: 1,
            height: 56,
            borderRadius: 16,
            backgroundColor: k && k !== "del" ? C.key : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: F.display,
              fontSize: 21,
              color: k === "del" ? C.silver : C.text,
            }}
          >
            {k === "del" ? "\u232b" : k}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function TxRow({
  icon,
  dir,
  title,
  sub,
  amount,
  status,
  credit,
  pending,
  last,
}: {
  icon: string;
  dir?: string;
  title: string;
  sub: string;
  amount: string;
  status?: string;
  credit?: boolean;
  pending?: boolean;
  last?: boolean;
}) {
  const inFlow = dir === "in";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: inFlow ? C.upBg : "rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 15, color: inFlow ? C.up : C.silver }}>
          {icon}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Body size={13.5} semibold>
          {title}
        </Body>
        <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>
          {sub}
        </Body>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Mono size={13} color={credit ? C.up : C.text}>
          {amount}
        </Mono>
        {status ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            {pending ? <PulseDot /> : null}
            <Body size={10.5} color={pending ? C.amber : C.dim}>
              {status}
            </Body>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  tone = "silver",
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Which accent marks the selected chip — chrome by default, brand on trade surfaces. */
  tone?: "silver" | "brand";
}) {
  const brandTone = tone === "brand";
  const accent = brandTone ? C.brandSoft : C.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={{
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: active ? accent : C.border,
        backgroundColor: active
          ? brandTone
            ? C.brandGlow
            : "rgba(255,255,255,0.1)"
          : C.card,
      }}
    >
      <Text
        style={{
          fontFamily: F.bodySemibold,
          fontSize: 12,
          color: active ? (brandTone ? C.brandSoft : "#e8e8ea") : C.silver,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Filled brand action — the loudest button in the system. Reserved for the one
 * thing a screen wants you to do, so never put two on the same surface.
 */
export function PrimaryButton({
  label,
  onPress,
  icon,
  trailing,
  height = 56,
  radius = PILL,
  uppercase = true,
  color = C.brandSoft,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  /** Glyph after the label — the "and then onward" shape, e.g. an arrow. */
  trailing?: React.ReactNode;
  height?: number;
  radius?: number;
  /** Off for conversational CTAs, where tracked caps read as shouting. */
  uppercase?: boolean;
  /** Fill. `C.brand` is the brighter cousin, for a lone CTA on a dark page. */
  color?: string;
}) {
  return (
    <PressableScale onPress={onPress} scale={0.98}>
      <View
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          height,
          borderRadius: radius,
          backgroundColor: color,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {icon}
        <Text
          style={{
            fontFamily: uppercase ? F.bodySemibold : F.displayBold,
            fontSize: uppercase ? 14 : 16,
            letterSpacing: uppercase ? 1.4 : 0.2,
            color: C.brandSoftInk,
          }}
        >
          {uppercase ? label.toUpperCase() : label}
        </Text>
        {trailing}
      </View>
    </PressableScale>
  );
}

/**
 * Outlined action with an optional leading badge — the "fund wallet" shape.
 * Reads quieter than MetallicButton, so it can sit right under a balance
 * without competing with it.
 */
export function OutlineButton({
  label,
  onPress,
  icon,
  height = 54,
  radius = PILL,
  color = C.brandSoft,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  height?: number;
  radius?: number;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        height,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: C.card,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {icon}
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 13,
          letterSpacing: 1.6,
          color,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

/**
 * A sign-in row: provider mark on the left, sentence-case label beside it,
 * pill shape. Sentence case is the point — every other button in the system
 * shouts in uppercase, and a provider's name is a proper noun, not a command.
 *
 * `tone` picks the one preferred method out of the stack: `brand` fills it,
 * `neutral` is the quiet translucent shape the rest sit in.
 */
export function AuthButton({
  label,
  icon,
  onPress,
  tone = "neutral",
  height = 48,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  tone?: "brand" | "neutral";
  height?: number;
}) {
  const brand = tone === "brand";
  return (
    <PressableScale onPress={onPress} scale={0.98}>
      <View
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          height,
          borderRadius: PILL,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          backgroundColor: brand ? C.brand : "rgba(255,255,255,0.09)",
          borderWidth: brand ? 0 : 1,
          borderColor: C.hairline,
        }}
      >
        {icon}
        <Text
          style={{
            fontFamily: F.bodyMedium,
            fontSize: 15,
            color: brand ? C.brandSoftInk : C.text,
          }}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
