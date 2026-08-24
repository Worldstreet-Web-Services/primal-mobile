import {
  GlassView,
  isLiquidGlassAvailable,
  type GlassStyle,
} from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Svg, { Path, Polyline } from "react-native-svg";
import { cn } from "../lib/cn";
import { C, F, metalStops } from "../theme/tokens";
import { KashPlusLoader } from "./KashPlusMark";

export function Screen({
  children,
  pad = 20,
  top = 0,
  bottom = 40,
  center = false,
  showsScrollIndicator = false,
  keyboardShouldPersistTaps,
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
  /**
   * Set `"handled"` on any screen with a text field: the default swallows the
   * first tap to dismiss the keyboard, so a button under an open keyboard needs
   * pressing twice — which on a form reads as a button that does not work.
   */
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
}) {
  return (
    <ScrollView
      className="flex-1 bg-canvas"
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
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
  const v = useMemo(() => new Animated.Value(1), []);
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
  badgeRingClassName = "border-canvas",
  accessibilityLabel,
  className,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  /** Unread marker in the top-right notch. */
  badge?: boolean;
  /**
   * What the badge is cut out of. It is a ring in the GROUND's colour, not a
   * border — its whole job is to hold a gap between the dot and whatever it
   * overlaps, so on a button with a filled face this has to be that face.
   */
  badgeRingClassName?: string;
  accessibilityLabel?: string;
  /** Override the outline — a fill, where the button sits over artwork. */
  className?: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={cn(
        "items-center justify-center rounded-full border border-border",
        className,
      )}
      // Size is a caller-supplied number.
      style={[{ width: size, height: size }, style]}
    >
      {children}
      {badge ? (
        // Green, not the brand: an unread dot is a liveness signal, and green
        // is the colour this app signals liveness in.
        <View
          className={cn(
            "absolute right-[7px] top-[6px] h-2 w-2 rounded-full border-[1.5px] bg-green",
            badgeRingClassName,
          )}
        />
      ) : null}
    </Pressable>
  );
}

export function Shine() {
  return (
    <View
      pointerEvents="none"
      className="absolute top-[0px] left-[12px] right-[12px] h-[1px]"
      style={{
        backgroundColor: "rgba(255,255,255,0.28)",
      }}
    />
  );
}

/**
 * The raked angle every metal surface is lit from. Shared so a row of metal
 * elements looks lit by one source rather than each catching its own.
 */
export const METAL_ANGLE = {
  start: { x: 0.1, y: 0 },
  end: { x: 0.9, y: 1 },
} as const;

/**
 * A milled metal face — the app's "white". Fills its parent, so give the
 * parent the radius and `overflow: "hidden"` and lay content over this.
 *
 * The specular hairline along the top edge is what sells it: without that one
 * bright line the gradient reads as grey plastic.
 */
export function MetalFill({
  radius = 0,
  shine = true,
}: {
  radius?: number;
  shine?: boolean;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute top-[0px] left-[0px] right-[0px] bottom-[0px] overflow-hidden"
      style={{
        borderRadius: radius,
      }}
    >
      <LinearGradient
        colors={C.metal}
        locations={metalStops}
        start={METAL_ANGLE.start}
        end={METAL_ANGLE.end}
        style={{ flex: 1 }}
      />
      {shine ? (
        <View className="absolute top-[0px] left-[6px] right-[6px] h-[1px] bg-metal-shine" />
      ) : null}
    </View>
  );
}

export function Card({
  children,
  className,
  style,
}: {
  children?: React.ReactNode;
  className?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      className={cn(
        "overflow-hidden rounded-[20px] border border-border bg-card p-4",
        className,
      )}
      style={style}
    >
      <Shine />
      {children}
    </View>
  );
}

/**
 * Indeterminate spinner. `ActivityIndicator` is the platform-native control and
 * needs no animation loop of our own, so async state looks the same here as it
 * does everywhere else on the device.
 */
export function Spinner({
  size = "small",
  color = C.text,
}: {
  size?: "small" | "large";
  color?: string;
}) {
  return <ActivityIndicator size={size} color={color} />;
}

/**
 * Brand-filled action — the workhorse CTA inside the app.
 *
 * The name is a leftover from an earlier palette: this is *green*, not metal.
 * The actual brushed-metal pill is `MetalButton` below. Renaming this would
 * touch two dozen screens for no visual change, so the honest fix is this note
 * plus a correctly-named sibling.
 */
export function MetallicButton({
  label,
  onPress,
  height = 52,
  radius = PILL,
  size = 15,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
  size?: number;
  /** Swaps the label for a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
}) {
  const inert = loading || disabled;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      className={cn(disabled && !loading && "opacity-45")}
      style={{
        // `shadowColor` is a value RN reads directly — no utility maps to it.
        // The glow picks up the fill; a white halo around the brand reads as
        // haze rather than lift.
        shadowColor: C.brand,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
      }}
    >
      <View
        className="items-center justify-center overflow-hidden bg-brand"
        // Both are caller-supplied numbers.
        style={{ height, borderRadius: radius }}
      >
        {/* The specular hairline along the top edge. */}
        <View
          pointerEvents="none"
          className="absolute left-2.5 right-2.5 top-px h-px bg-metal-shine"
        />
        {loading ? (
          <Spinner color={C.brandInk} />
        ) : (
          <Text
            className="font-body-semibold text-brand-ink"
            style={{ fontSize: size }}
          >
            {label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Height of the auth-scale pills. Taller than the in-app buttons (52) because
 * on an onboarding screen the pill *is* the content — at 52 under a 34pt
 * headline it starts to read as a form field rather than a decision.
 */
export const AUTH_PILL_HEIGHT = 58;

/**
 * The bevel, lifted from Ark's button spec so the two apps share one object.
 *
 * `ring` is drawn as the OUTER gradient and shows only through `border` points
 * of padding — it is the rim, not a backdrop. Both gradients run top-to-bottom;
 * the rim's bright-to-dark fall is what reads as a machined edge, and running it
 * on any other axis loses the effect. Values are Ark's, kept exact rather than
 * re-derived from our palette: the ask was the same button, and a silver rim is
 * the same silver on any ground.
 */
const BEVEL = {
  border: 4,
  axis: { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } },
  metal: {
    ring: ["#D4D4D8", "#3C3C3C"] as [string, string],
    fill: ["#B1B6BA", "#C9CACC"] as [string, string],
    text: "#3C3C3C",
  },
  metalOff: {
    ring: ["#9EA2A6", "#4A4A4A"] as [string, string],
    fill: ["#A9ADB1", "#B8B9BB"] as [string, string],
    text: "#6B6E71",
  },
  quiet: {
    ring: ["#0F0F0F", "#3C3C3C"] as [string, string],
    fill: ["#1C1C1C", "#3C3C3C"] as [string, string],
    text: "#DCDCDC",
  },
  /**
   * The outline tier, added 2026-08-21 for the sign-in reference — and NOT one
   * of Ark's three, because it is not a bevel at all.
   *
   * `fill` is transparent and means it: the canvas runs straight through this
   * button, so the only things on screen are the line and the label. That is
   * what lets it recede beside the `MetalButton` it is stacked with while still
   * reading as a control, where a dark filled face on true black gives you one
   * solid button and one smudge.
   *
   * Which is why `AuthPill` draws this tone as a BORDERED BOX rather than with
   * the ring-as-padding trick the other two use. That trick works by laying an
   * opaque fill over a ring layer so only `rim` points of the ring survive
   * round the edge — put a transparent fill on top instead and the ring shows
   * through the whole face, which renders the pill as a solid grey slab. `ring`
   * is therefore the border colour here, and one flat grey rather than a fall
   * from light to dark: a bevel describes a raised face catching light, and
   * there is no face here to raise.
   */
  outline: {
    ring: ["#4E4E51", "#4E4E51"] as [string, string],
    fill: ["transparent", "transparent"] as [string, string],
    // A GETTER, not a value. `BEVEL` is module scope, so a plain `C.text` here
    // is read once at import — before the app has settled its theme — and the
    // label bakes to whatever palette happened to be active then. Every
    // theme-dependent value on a module-scope constant has to defer like this.
    get text() {
      return C.text;
    },
  },
} as const;

/**
 * Rim width per tone. Ark's 4pt band IS the bevel; on the outline tier that
 * same 4pt stops being a line around a hole and becomes a frame, while 1pt
 * disappears against true black on a 3x screen.
 */
const RIM = { metal: 4, metalOff: 4, quiet: 4, outline: 1.5 } as const;

/**
 * The row inside the edge, whichever way the edge is drawn. Both of
 * `AuthPill`'s paths call this, so a metal pill and an outline pill stacked
 * together put their marks and their labels on exactly the same line.
 */
const FACE = (height: number, radius: number, rim: number): ViewStyle => ({
  height: height - rim * 2,
  borderRadius: radius - rim,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  // 24 is the auth-scale inset, where a pill spans the gutter and has room to
  // spare. Below that height these come in pairs sharing a row — two 50pt
  // pills inside a card on a 375pt screen leave ~146pt each, and 24 a side
  // ellipsises "Deposit". The label is the content; the inset is not.
  paddingHorizontal: height >= AUTH_PILL_HEIGHT ? 24 : 16,
});

type PillProps = {
  label: string;
  onPress?: () => void;
  /** Leading glyph. On the metal tier it must be inked dark — see `C.metalInk`. */
  icon?: React.ReactNode;
  height?: number;
  radius?: number;
  /** Label size. Only move it if the label genuinely cannot fit. */
  size?: number;
  /** Swaps the label for the falling mark and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * The two-tier auth pill. `MetalButton` is the light brushed face, `QuietButton`
 * the dark one, and they are the same component on purpose: one height, one
 * radius, one press curve, so a stack of them reads as a single system with one
 * loud member rather than as three unrelated buttons.
 */
/**
 * Ark's beveled pill, ported to KashPlus.
 *
 * Structure is Ark's spec verbatim (its `src/components/common/Button.tsx`,
 * dated 2026-07-31) because the client asked for the same button: TWO stacked
 * VERTICAL gradients, where the outer one is not a background but the 4pt ring
 * itself, and the inner fill sits on top of it. That is what makes the rim read
 * as a machined bevel — a bright top edge falling to dark at the base — rather
 * than as a border drawn around a fill. A single diagonal gradient cannot
 * produce it, which is why this replaced the brushed `MetalFill` treatment.
 *
 * `MetalButton` is the silver tier, `QuietButton` the dark one. Same component
 * on purpose: one height, one radius, one press curve, so a stack of them reads
 * as one system with a single loud member.
 */
function AuthPill({
  tone,
  label,
  onPress,
  icon,
  height = AUTH_PILL_HEIGHT,
  loading = false,
  disabled = false,
  style,
}: PillProps & { tone: "metal" | "quiet" | "outline" }) {
  const metal = tone === "metal";
  const inert = loading || disabled;
  const key = metal && disabled ? "metalOff" : tone;
  const skin = BEVEL[key];
  const rim = RIM[key];
  const radius = height / 2;
  const outline = tone === "outline";

  // Hoisted so both paths below lay the row out from the SAME numbers. When
  // this was duplicated per path, the outline tier's mark and label sat a
  // couple of points off the `MetalButton` stacked under it.
  const face = loading ? (
    // The mark falling into place rather than a platform spinner. This wait is
    // ours — a provider round-trip, sometimes key generation — and long enough
    // that a system spinner reads as a stall.
    <KashPlusLoader height={22} color={skin.text} />
  ) : (
    <>
      {icon}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: F.display,
          fontSize: 16,
          lineHeight: 22,
          // Ark's spec is -0.7% of the size.
          letterSpacing: -0.112,
          color: skin.text,
        }}
      >
        {label}
      </Text>
    </>
  );

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        {
          // Ark dims the silver tier when disabled and deliberately does NOT
          // dim the dark one — a secondary that is dark at rest reads as broken
          // rather than as unavailable when it fades. The outline tier dims
          // with the silver: it has no face to read as dark, so the line at
          // full strength would be the only thing still saying "button".
          opacity:
            disabled && tone !== "quiet" ? 0.45 : pressed && !inert ? 0.85 : 1,
        },
        style,
      ]}
    >
      {outline ? (
        // A border, not a ring layer — see the note on `BEVEL.outline`. The
        // border eats its own `rim` off the box, so the inner row lands on the
        // same metrics as the bevelled path without any padding of its own.
        <View
          style={{
            borderRadius: radius,
            borderWidth: rim,
            borderColor: skin.ring[0],
          }}
        >
          <View style={FACE(height, radius, rim)}>{face}</View>
        </View>
      ) : (
        <LinearGradient
          colors={skin.ring}
          start={BEVEL.axis.start}
          end={BEVEL.axis.end}
          style={{ borderRadius: radius, padding: rim }}
        >
          <LinearGradient
            colors={skin.fill}
            start={BEVEL.axis.start}
            end={BEVEL.axis.end}
            style={FACE(height, radius, rim)}
          >
            {face}
          </LinearGradient>
        </LinearGradient>
      )}
    </Pressable>
  );
}

/** Primary auth action: the silver bevel. */
export function MetalButton(props: PillProps) {
  return <AuthPill tone="metal" {...props} />;
}

/** Secondary auth action: the same bevel, dark. */
export function QuietButton(props: PillProps) {
  return <AuthPill tone="quiet" {...props} />;
}

export function GhostButton({
  label,
  onPress,
  height = 46,
  radius = PILL,
  size = 13,
  style,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  height?: number;
  radius?: number;
  /** Label size — raise it when the button is paired with a full-weight CTA. */
  size?: number;
  style?: ViewStyle;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inert = loading || disabled;
  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      className="bg-card border border-border items-center justify-center"
      style={[
        {
          height,
          borderRadius: radius,
          opacity: disabled && !loading ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <Spinner />
      ) : (
        <Text
          style={{ color: C.text, fontFamily: F.bodyMedium, fontSize: size }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Label({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      className={cn(
        "font-mono text-[10px] uppercase tracking-[1.5px] text-dim",
        className,
      )}
      style={style}
    >
      {children}
    </Text>
  );
}

export function Mono({
  children,
  size,
  color,
  className,
  style,
}: {
  children: React.ReactNode;
  /** @deprecated Use `className="text-[13px]"`. Kept for unmigrated callers. */
  size?: number;
  /** @deprecated Use `className="text-up"`. Kept for unmigrated callers. */
  color?: string;
  className?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      className={cn("font-mono text-[12px] text-silver", className)}
      style={[
        // No utility maps to this, and it is what keeps a column of amounts
        // from changing width as its digits change. The app is one family now
        // and Urbanist has no monospace cut, so the alignment comes from the
        // numeral set rather than the face.
        { fontVariant: ["tabular-nums"] as const },
        // Inline wins over className in NativeWind, so these still override.
        size !== undefined ? { fontSize: size } : null,
        color !== undefined ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Display({
  children,
  size,
  color,
  numberOfLines,
  className,
  style,
}: {
  children: React.ReactNode;
  /** @deprecated Use `className="text-[28px] leading-[30px]"`. */
  size?: number;
  /** @deprecated Use `className="text-brand"`. */
  color?: string;
  /** Clamp to this many lines, ellipsizing the overflow. */
  numberOfLines?: number;
  className?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      className={cn(
        "font-display text-[34px] leading-[36px] text-text",
        className,
      )}
      style={[
        // The 1.05 ratio has to be computed from whatever size is passed, so it
        // cannot be a class while this prop still exists.
        size !== undefined ? { fontSize: size, lineHeight: size * 1.05 } : null,
        color !== undefined ? { color } : null,
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
  color,
  emphasizeCents = true,
  className,
  style,
}: {
  value: string;
  /** Drives the tail size too, so it stays a number rather than a class. */
  size?: number;
  /** @deprecated Use `className="text-up"`. */
  color?: string;
  emphasizeCents?: boolean;
  className?: string;
  style?: TextStyle;
}) {
  const dot = emphasizeCents ? value.lastIndexOf(".") : -1;

  if (dot === -1) {
    return (
      <Display size={size} color={color} className={className} style={style}>
        {value}
      </Display>
    );
  }

  return (
    <Display size={size} color={color} className={className} style={style}>
      {value.slice(0, dot)}
      {/* The decimals drop a size and a rung of contrast so the whole units
          carry the glance. Size is computed off `size`, hence the style. */}
      <Text
        className="font-display text-figure-tail"
        style={{ fontSize: size * 0.55 }}
      >
        {value.slice(dot)}
      </Text>
    </Display>
  );
}

export function Body({
  children,
  size,
  color,
  semibold,
  numberOfLines,
  className,
  style,
}: {
  children: React.ReactNode;
  /** @deprecated Use `className="text-[12.5px]"`. */
  size?: number;
  /** @deprecated Use `className="text-dim"`. */
  color?: string;
  /** @deprecated Use `className="font-body-semibold"`. */
  semibold?: boolean;
  /** Clamp to this many lines, ellipsizing the overflow. */
  numberOfLines?: number;
  className?: string;
  style?: TextStyle;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      className={cn(
        "font-body text-[13px] text-text",
        semibold && "font-body-semibold",
        className,
      )}
      style={[
        size !== undefined ? { fontSize: size } : null,
        color !== undefined ? { color } : null,
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
    // Breathing room below the safe area — the routes wrap this in a
    // SafeAreaView, so pt-1 put the title hard against the Dynamic Island.
    // Matches the +6..+10 the floating headers add over `insets.top`.
    <View className="flex-row items-center gap-2.5 pb-1 pt-[18px]">
      <Pressable onPress={onBack} hitSlop={10}>
        <BackChevron />
      </Pressable>
      <Display className="text-[20px] leading-[21px]">{title}</Display>
      <View className="flex-1" />
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
  const v = useMemo(() => new Animated.Value(1), []);
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
    <View className="h-1.5 overflow-hidden rounded-[99px] bg-card">
      <LinearGradient
        colors={["#7a7a7a", "#e8e8ea"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        // `colors` is a prop, not a style; the width is computed from `pct`.
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
            <View
              style={{
                paddingVertical: 8,
                borderRadius: 9,
                alignItems: "center",
                overflow: "hidden",
              }}
            >
              <MetalFill radius={9} />
              <Text
                style={{
                  fontFamily: F.bodySemibold,
                  fontSize: 12.5,
                  color: C.metalInk,
                }}
              >
                {t}
              </Text>
            </View>
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

/** The empty bead's resting ground, and the one it is rejected in. */
const DOT_EMPTY = "rgba(199,204,209,0.22)";
/** `C.down` at the same weight — a wrong PIN colours the row it was typed into. */
const DOT_REJECTED = "rgba(246,165,165,0.42)";

/** Where each leg of the shake lands, in px, and how long a leg takes. */
const SHAKE_LEGS = [-9, 9, -7, 7, -3, 0];
const SHAKE_LEG_MS = 55;

/**
 * Four beads that fill as digits land — and the place a rejected PIN is felt.
 *
 * `shake` is a nonce rather than a boolean because the same PIN typed wrong
 * twice is the same error state twice over, and a boolean would animate only
 * the first of them. Bumping a number makes every rejection its own event, so
 * the effect fires on the *change* rather than on the value.
 *
 * The three cues are deliberately one gesture: the row shakes, the device
 * buzzes, and the empty beads take the down colour and let it go. The colour is
 * what remains for anyone whose phone has no taptic engine or who has turned
 * the haptic off — the rejection must not depend on being felt.
 */
export function PinDots({
  filled,
  shake = 0,
}: {
  filled: number;
  /** Bump to reject the entry: the row shakes, buzzes and flushes red. */
  shake?: number;
}) {
  const x = useMemo(() => new Animated.Value(0), []);
  const flush = useMemo(() => new Animated.Value(0), []);
  // Mounting is not a rejection — only a change to `shake` is one. Read in the
  // effect only, which is where a ref is allowed to be looked at.
  const seen = useRef(shake);

  useEffect(() => {
    if (shake === seen.current) return;
    seen.current = shake;

    // Fired with the first displacement rather than ahead of it, so the buzz
    // and the movement read as one event. It rejects on web and on a device
    // with the motor disabled, neither of which is a failure worth surfacing.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {},
    );

    x.setValue(0);
    flush.setValue(1);
    Animated.parallel([
      Animated.sequence(
        SHAKE_LEGS.map((to) =>
          Animated.timing(x, {
            toValue: to,
            duration: SHAKE_LEG_MS,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ),
      ),
      // Held for the length of the shake, then released. Its own driver because
      // `backgroundColor` is not a transform and cannot go native.
      Animated.timing(flush, {
        toValue: 0,
        duration: 520,
        delay: SHAKE_LEGS.length * SHAKE_LEG_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();
  }, [shake, x, flush]);

  const ground = flush.interpolate({
    inputRange: [0, 1],
    outputRange: [DOT_EMPTY, DOT_REJECTED],
  });

  return (
    <Animated.View
      className="flex-row justify-center gap-4"
      // Driven by the shake sequence, so it cannot be a class.
      style={{ transform: [{ translateX: x }] }}
    >
      {[0, 1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          className="h-[25px] w-[25px] overflow-hidden rounded-full"
          // Interpolated between the resting and rejected grounds.
          style={{ backgroundColor: i < filled ? undefined : ground }}
        >
          {/* Filled dots are milled beads, not white pips — same light source
              as every other metal face on the screen. */}
          {i < filled ? <MetalFill radius={8} shine={false} /> : null}
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
export function Keypad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {KEYS.map((k, i) => (
        <Pressable
          key={i}
          disabled={!k}
          onPress={() => onKey(k)}
          className={cn(
            "h-14 w-[31%] grow items-center justify-center rounded-2xl",
            k && k !== "del" ? "bg-key" : "bg-transparent",
          )}
        >
          <Text
            className={cn(
              "font-display text-[21px]",
              k === "del" ? "text-silver" : "text-text",
            )}
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
      className={cn(
        "flex-row items-center gap-3 py-3",
        last ? "border-b-0" : "border-b border-b-rule",
      )}
    >
      <View
        className={cn(
          "h-[38px] w-[38px] items-center justify-center rounded-xl",
          inFlow ? "bg-up-tint" : "bg-card",
        )}
      >
        <Text className={cn("text-[15px]", inFlow ? "text-up" : "text-silver")}>
          {icon}
        </Text>
      </View>
      <View className="flex-1">
        <Body className="font-body-semibold text-[13.5px]">{title}</Body>
        <Body className="mt-0.5 text-[11.5px] text-dim">{sub}</Body>
      </View>
      <View className="items-end">
        <Mono className={cn("text-[13px]", credit ? "text-up" : "text-text")}>
          {amount}
        </Mono>
        {status ? (
          <View className="mt-0.5 flex-row items-center gap-1">
            {pending ? <PulseDot /> : null}
            <Body
              className={cn(
                "text-[10.5px]",
                pending ? "text-amber" : "text-dim",
              )}
            >
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
  compact = false,
  className,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /**
   * Which accent marks the selected chip — chrome by default, brand on trade
   * surfaces, `highlight` where the selection sits over green candles and the
   * brand color would disappear into them.
   */
  tone?: "silver" | "brand" | "highlight";
  /** Tighter padding, for a row that has to fit many (a range picker). */
  compact?: boolean;
  className?: string;
  style?: ViewStyle;
}) {
  const accentBorder =
    tone === "brand"
      ? "border-brand-soft"
      : tone === "highlight"
        ? "border-highlight"
        : "border-accent";
  const accentText =
    tone === "brand"
      ? "text-brand-soft"
      : tone === "highlight"
        ? "text-highlight"
        : "text-text";
  const activeFill =
    tone === "brand"
      ? "bg-brand-glow"
      : tone === "highlight"
        ? "bg-transparent"
        : "bg-card";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      className={cn(
        "items-center rounded-full border",
        compact ? "px-2 py-2" : "px-[15px] py-[9px]",
        active
          ? cn(accentBorder, activeFill)
          : cn(compact ? "border-transparent" : "border-border", "bg-card"),
        className,
      )}
      style={style}
    >
      <Text
        className={cn(
          "font-body-semibold",
          compact ? "text-[11.5px]" : "text-[12px]",
          active ? accentText : "text-silver",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Label on the left, value on the right, hairline underneath — the receipt
 * shape. Used wherever a screen has to state a handful of facts about one
 * thing (a position, a transfer, a plan).
 */
export function KeyValueRow({
  label,
  value,
  valueColor,
  valueClassName,
  last = false,
}: {
  label: string;
  value: string;
  /** @deprecated Use `valueClassName="text-up"`. */
  valueColor?: string;
  /** Accent for the value — a P&L figure, a warning. */
  valueClassName?: string;
  last?: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row items-center gap-3 py-[15px]",
        last ? "border-b-0" : "border-b border-b-rule",
      )}
    >
      <Text className="flex-1 font-body text-[13.5px] text-sub">{label}</Text>
      <Text
        className={cn(
          "font-body-semibold text-[14px] text-text",
          valueClassName,
        )}
        style={valueColor !== undefined ? { color: valueColor } : null}
      >
        {value}
      </Text>
    </View>
  );
}

export interface KeyValue {
  label: string;
  /** Preformatted — the UI never does the math. */
  value: string;
  /** @deprecated Use `valueClassName`. */
  valueColor?: string;
  valueClassName?: string;
}

/** The rows above, grouped into one card. */
export function KeyValueList({
  rows,
  className,
  style,
}: {
  rows: KeyValue[];
  className?: string;
  style?: ViewStyle;
}) {
  return (
    <View
      className={cn(
        "rounded-[18px] border border-rule bg-canvas-raised px-4",
        className,
      )}
      style={style}
    >
      {rows.map((row, i) => (
        <KeyValueRow
          key={row.label}
          label={row.label}
          value={row.value}
          valueColor={row.valueColor}
          valueClassName={row.valueClassName}
          last={i === rows.length - 1}
        />
      ))}
    </View>
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
  style,
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
  style?: ViewStyle;
}) {
  return (
    <PressableScale onPress={onPress} scale={0.98} style={style}>
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
 * Outlined action with an optional leading badge, in two tones.
 *
 * `brand` is the "fund wallet" shape — a gold hairline over `C.card`, tracked
 * uppercase mono. It reads quieter than `MetallicButton`, so it can sit right
 * under a balance without competing with it, but it is still a filled surface.
 *
 * `auth` is the sign-in reference's KingsChat row: an auth-scale pill with NO
 * FILL AT ALL, so the canvas runs straight through it and the only thing on
 * screen is the line and the label. That is what lets it recede beside the
 * `MetalButton` it is stacked with while still reading as a control — a dark
 * filled face on true black gives you one solid button and one smudge. It is
 * drawn by `AuthPill` (tone `outline`), not here; see the note on `BEVEL`.
 *
 * `brand` is the default, so the existing funding call site keeps its shape
 * without having to say anything.
 */
export function OutlineButton({
  label,
  onPress,
  icon,
  tone = "brand",
  height,
  radius = PILL,
  color = C.brandSoft,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  /** `brand` is the gold funding shape; `auth` is the sign-in outline pill. */
  tone?: "brand" | "auth";
  height?: number;
  radius?: number;
  /** Stroke and ink. The gold is deliberately both. `auth` ignores it. */
  color?: string;
  /** Swaps the label for the falling mark and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const inert = loading || disabled;

  // The auth tone IS an auth pill, so it is built by the thing that builds auth
  // pills. Reimplementing that box here is what put its mark and its label a
  // couple of points off the `MetalButton` directly underneath it.
  if (tone === "auth") {
    return (
      <AuthPill
        tone="outline"
        label={label}
        icon={icon}
        onPress={onPress}
        height={height}
        loading={loading}
        disabled={disabled}
        style={style}
      />
    );
  }

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
      style={({ pressed }) => [
        {
          height: height ?? 54,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: color,
          backgroundColor: C.card,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: disabled && !loading ? 0.4 : pressed && !inert ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <Spinner color={color} />
      ) : (
        <>
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
        </>
      )}
    </Pressable>
  );
}

/**
 * Pill action on a glass ground, sized to its label rather than the gutter.
 *
 * The shape for something that floats over scrolling content: it reads as
 * chrome sitting above the page instead of a block ending it, and the narrow
 * width leaves the rows either side of it visible.
 */
export function GlassButton({
  label,
  onPress,
  icon,
  height = 56,
  effect = "regular",
  tintOpacity,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
  height?: number;
  /** Blur strength on devices with native glass. */
  effect?: GlassStyle;
  /** 0–1 darkening over the blur. Omit for the shared chrome value. */
  tintOpacity?: number;
  style?: ViewStyle;
}) {
  return (
    <PressableScale onPress={onPress} scale={0.97} style={style}>
      <View
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          height,
          paddingHorizontal: 28,
          borderRadius: PILL,
          // Clips the glass to the pill; the layer draws its own backing and
          // squares itself off otherwise.
          overflow: "hidden",
          borderWidth: 1,
          borderColor: C.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <GlassSurface
          radius={PILL}
          bordered={false}
          effect={effect}
          tintOpacity={tintOpacity}
        />
        {icon}
        <Text
          style={{
            fontFamily: F.bodySemibold,
            fontSize: 14,
            letterSpacing: 1.4,
            color: C.text,
          }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
    </PressableScale>
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
/**
 * Quiet placeholder for a figure that has not landed yet. It breathes on its
 * own opacity instead of sliding a highlight across itself — a shimmer reads
 * as a loading spinner in a good suit, and this system would rather look calm
 * than busy. Size it to the type it stands in for so nothing jumps on arrival.
 *
 * The amber waiting *state* is a different thing: that is `PulseDot`.
 */
export function Pulse({
  width = "100%",
  height = 12,
  radius = 6,
  style,
}: {
  width?: ViewStyle["width"];
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const v = useMemo(() => new Animated.Value(0.3), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.62,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);

  return (
    <Animated.View
      className="bg-canvas-inset"
      style={[{ width, height, borderRadius: radius }, { opacity: v }, style]}
    />
  );
}

/**
 * The hairline between two sections, carrying its own breathing room so the
 * vertical cadence stays the same wherever it lands. `space` is the gap on
 * each side: 18 is the section step, 12 the tighter one inside a card, 26 the
 * one that separates two whole thoughts. `inset` pulls the rule off the edges
 * when it sits inside a padded surface and should not touch the border.
 */
export function SectionRule({
  space = 18,
  inset = 0,
}: {
  space?: number;
  inset?: number;
}) {
  return (
    <View
      className="h-px bg-rule"
      // Both margins are caller-supplied numbers.
      style={{ marginVertical: space, marginHorizontal: inset }}
    />
  );
}

/**
 * A two-state switch, drawn rather than platform-native.
 *
 * RN's `Switch` renders the OS control — iOS grey-green over white, Android's
 * Material thumb — and neither belongs on this canvas next to a brand-green
 * CTA. This is the same affordance in the app's own palette: brand fill when
 * on, the card wash when off, with the knob sliding between them.
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const W = 52;
  const H = 30;
  const KNOB = 24;
  const travel = W - KNOB - 6;

  // Seeded from the initial `value` only; the effect below drives it after.
  const x = useMemo(() => new Animated.Value(value ? 1 : 0), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    Animated.timing(x, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [value, x]);

  return (
    <Pressable
      onPress={disabled ? undefined : () => onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      className={cn(
        "justify-center border p-[3px]",
        value ? "border-transparent bg-brand" : "border-border bg-card",
        disabled && "opacity-45",
      )}
      // Track geometry is derived from the knob travel below, so it stays here.
      style={{ width: W, height: H, borderRadius: H / 2 }}
    >
      <Animated.View
        // Ink-dark on the brand fill so the knob reads as a cut in the track
        // rather than a second bright object beside the label.
        className={value ? "bg-brand-ink" : "bg-silver"}
        style={{
          width: KNOB,
          height: KNOB,
          borderRadius: KNOB / 2,
          transform: [
            {
              translateX: x.interpolate({
                inputRange: [0, 1],
                outputRange: [0, travel],
              }),
            },
          ],
        }}
      />
    </Pressable>
  );
}
