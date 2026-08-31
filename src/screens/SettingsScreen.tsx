import { type ImageSource } from "expo-image";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/home";
import {
  BadgeCheckIcon,
  DeviceIcon,
  DocIcon,
  EyeOffIcon,
  KeyIcon,
  LifeRingIcon,
  LockIcon,
  MoonIcon,
  PersonIcon,
  ShieldCheckIcon,
  SparkleIcon,
  SunIcon,
} from "@/components/icons";
import { useMiniPlayerClearance } from "@/components/podcast";
import {
  Body,
  Card,
  Display,
  Label,
  Mono,
  OutlineButton,
  PressableScale,
  Screen,
  Spinner,
  Toggle,
} from "@/components/ui";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { cn } from "@/lib/cn";
import type { ThemePreference } from "@/theme/preference";
import { C, PALETTES, useTokens, type Palette } from "@/theme/tokens";

/* --------------------------------------------------------------- pieces */

/** How the subscription's word is inked. `on` is entitled, `warn` is in-flight. */
export type PlanTone = "on" | "warn" | "off";

export interface PlanBadge {
  /** One word, at the end of the row — "Active", "Free", "Pending". */
  label: string;
  tone: PlanTone;
  /** What that word means, on the row's sub line. */
  note: string;
}

/**
 * The biometric control's whole state, assembled by the route.
 *
 * `available` and `enabled` are deliberately separate: the first is what the
 * DEVICE can do and the second is what the user asked for. A handset with no
 * enrolment gets the row disabled with the reason on it, rather than a switch
 * that flips back on its own.
 */
export interface BiometricSetting {
  /** "Face ID", "Touch ID", "Fingerprint" — the device's own word for it. */
  label: string;
  available: boolean;
  enabled: boolean;
  /** A prompt is on screen; the switch waits rather than double-firing. */
  busy?: boolean;
  onToggle?: (next: boolean) => void;
}

/**
 * Corner marker for a row with nowhere to go — the same word, in the same type,
 * the unbuilt feature tiles use. A settings list that quietly swallows taps is
 * worse than one that says which doors are not cut yet.
 */
function SoonChip() {
  return (
    <View className="rounded-[6px] bg-canvas-inset px-[6px] py-[2.5px]">
      <Text className="font-mono text-[9px] tracking-[1.1px] text-dim">
        SOON
      </Text>
    </View>
  );
}

/** The chevron on a row that goes somewhere. Text, as on the Profile rows. */
function Chevron() {
  return <Body className="text-[15px] text-dim">›</Body>;
}

/**
 * One line of a group: glyph, title over a sub line, and the row's accessory.
 *
 * Same geometry as the Profile rows — 13.5 over 10.5, a hairline under all but
 * the last — with a glyph column added, since a settings list is scanned by
 * subject where Profile's is read top to bottom.
 */
function Row({
  icon,
  title,
  sub,
  right,
  onPress,
  last = false,
  dead = false,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  /** Drops the hairline — the card's own edge closes the list. */
  last?: boolean;
  /** No destination. Rendered recessed and inert. */
  dead?: boolean;
}) {
  const body = (
    <View
      className={cn(
        "flex-row items-center gap-[13px] py-[13px]",
        !last && "border-b border-b-rule",
      )}
      // A doorway that does not open reads as recessed rather than as broken —
      // the same 0.55 the unbuilt feature tiles use.
      style={{ opacity: dead ? 0.55 : 1 }}
    >
      <View className="w-[22px] items-center">{icon}</View>

      <View className="flex-1">
        <Body numberOfLines={1} className="text-[13.5px] font-body-semibold">
          {title}
        </Body>
        {sub ? (
          <Body className="mt-[2px] text-[10.5px] leading-[15px] text-dim">
            {sub}
          </Body>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress || dead) return body;
  return (
    <PressableScale onPress={onPress} scale={0.99} accessibilityLabel={title}>
      {body}
    </PressableScale>
  );
}

/** A captioned card of rows. `Label` and `Card` are the app's own pair. */
function Group({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={className}>
      <Label>{title}</Label>
      <Card className="mt-[10px] px-[16px] py-[2px]">{children}</Card>
    </View>
  );
}

/* --------------------------------------------------------------- theme */

/**
 * A palette, drawn as the ground it makes: canvas, a line of type, the brand.
 *
 * Read straight off `PALETTES`, so it is the actual theme rather than an
 * impression of one — change a value in `global.css` and its twin in
 * `tokens.ts`, and this moves with the app.
 */
function Swatch({ palette }: { palette: Palette }) {
  return (
    <View
      className="flex-1 justify-end gap-[5px] p-[8px]"
      // Every colour here belongs to a palette that is NOT in force, so none of
      // them can be a class — painting the other theme is the whole point.
      style={{ backgroundColor: palette.canvas }}
    >
      <View
        className="h-[5px] w-[62%] rounded-[3px]"
        style={{ backgroundColor: palette.text }}
      />
      <View
        className="h-[8px] w-[26px] rounded-[4px]"
        style={{ backgroundColor: palette.brand }}
      />
    </View>
  );
}

const THEMES: {
  key: ThemePreference;
  label: string;
  Glyph: typeof SunIcon;
}[] = [
  { key: "system", label: "System", Glyph: DeviceIcon },
  { key: "light", label: "Light", Glyph: SunIcon },
  { key: "dark", label: "Dark", Glyph: MoonIcon },
];

/**
 * The Appearance control.
 *
 * Each option shows the ground it sets. Two words cannot tell you that light
 * mode here is a re-derived palette rather than an inversion; the swatch can.
 * `system` shows both halves, which is what choosing it means.
 */
function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange?: (next: ThemePreference) => void;
}) {
  // SVG `color` is a prop, which no class reaches. `useTokens` subscribes, so
  // the glyphs repaint the instant the choice they set lands.
  const tokens = useTokens();

  return (
    <View className="flex-row gap-[10px] pb-[14px] pt-[14px]">
      {THEMES.map(({ key, label, Glyph }) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange?.(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${label} theme`}
            className="flex-1 gap-[8px]"
          >
            <View
              className={cn(
                "h-[52px] flex-row overflow-hidden rounded-[12px] border",
                active ? "border-brand" : "border-rule",
              )}
            >
              {key === "system" ? (
                // Both halves, because that is what the choice is: the OS picks.
                <>
                  <Swatch palette={PALETTES.light} />
                  <Swatch palette={PALETTES.dark} />
                </>
              ) : (
                <Swatch palette={PALETTES[key]} />
              )}
            </View>

            <View className="flex-row items-center gap-[5px]">
              <Glyph size={12} color={active ? tokens.brand : tokens.dim} />
              <Body
                numberOfLines={1}
                className={cn(
                  "flex-1 text-[11px]",
                  active ? "text-brand font-body-semibold" : "text-dim",
                )}
              >
                {label}
              </Body>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------------------------------------- screen */

export interface SettingsScreenProps {
  name: string;
  /** The handle, printed as written — this screen uppercases it itself. */
  tag: string;
  avatar?: ImageSource | number;
  /** Falls back to a person glyph when there is no portrait. */
  initial?: string;

  plan: PlanBadge;
  onOpenProfile?: () => void;
  onOpenSubscription?: () => void;
  onOpenVerification?: () => void;

  biometrics: BiometricSetting;
  onOpenPin?: () => void;
  onLockNow?: () => void;
  /** "2 minutes" — the window `useInactive` actually enforces, not a guess. */
  lockAfterLabel: string;

  masked: boolean;
  onToggleMasked?: () => void;

  theme: ThemePreference;
  onChangeTheme?: (next: ThemePreference) => void;

  version: string;
  signingOut?: boolean;
  onSignOut?: () => void;
  /**
   * Sign out AND forget this device's PIN and biometric answer. Quieter than
   * signing out on purpose — see `AuthContext.signOut`.
   */
  onSwitchAccount?: () => void;
}

/**
 * Settings — the tab root.
 *
 * Every control on it does something local and real: the biometric switch
 * writes the app-lock preference, "Lock now" closes the lock without ending the
 * session, Appearance repaints the app, and the eye is the same module store
 * the home figure reads. The rows that have no destination yet say SOON rather
 * than pretending — this app does not ship a control that looks live and isn't.
 *
 * What is deliberately NOT here: a notifications switch. Nothing in the app
 * registers for push or holds a preference one could toggle, so the switch
 * would be a lie with an animation on it.
 */
export default function SettingsScreen({
  name,
  tag,
  avatar,
  initial,
  plan,
  onOpenProfile,
  onOpenSubscription,
  onOpenVerification,
  biometrics,
  onOpenPin,
  onLockNow,
  lockAfterLabel,
  masked,
  onToggleMasked,
  theme,
  onChangeTheme,
  version,
  signingOut = false,
  onSignOut,
  onSwitchAccount,
}: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  // The native tab bar is not in the React tree, so it occludes the scroll
  // view's last line unless the page pays for it explicitly.
  const tabBar = useTabBarClearance();
  const player = useMiniPlayerClearance();
  const tokens = useTokens();

  const bio = biometrics;
  const bioSub = !bio.available
    ? `Not set up on this phone`
    : bio.enabled
      ? `On — your PIN still works`
      : `Unlock without typing your PIN`;

  return (
    <View className="flex-1 bg-canvas">
      <Screen top={insets.top + 6} bottom={tabBar + player}>
        <Display className="pt-[10px] text-[20px] leading-[21px]">
          Settings
        </Display>

        {/* The one block on the page that is a person rather than a preference. */}
        <PressableScale
          onPress={onOpenProfile}
          scale={0.99}
          accessibilityLabel="Profile and wallets"
        >
          <View className="mt-[18px] flex-row items-center gap-[13px] rounded-[20px] border border-border bg-card px-[16px] py-[14px]">
            <Avatar source={avatar} initial={initial} size={48} />
            <View className="flex-1">
              <Body numberOfLines={1} className="text-[15px] font-body-semibold">
                {name}
              </Body>
              <Mono className="mt-[3px] text-[10px] tracking-[1px] text-dim">
                {tag.toUpperCase()}
              </Mono>
            </View>
            <Chevron />
          </View>
        </PressableScale>

        {/* ------------------------------------------------------- account */}
        <Group title="Account" className="mt-[26px]">
          <Row
            icon={<PersonIcon size={18} color={tokens.silver} />}
            title="Profile & wallets"
            sub="Name, account number and addresses"
            right={<Chevron />}
            onPress={onOpenProfile}
          />
          <Row
            icon={<SparkleIcon size={17} color={tokens.silver} />}
            title="Subscription"
            sub={plan.note}
            right={
              <View className="flex-row items-center gap-[10px]">
                <Body
                  className={cn(
                    "text-[12px]",
                    plan.tone === "on" && "text-brand",
                    plan.tone === "warn" && "text-amber",
                    plan.tone === "off" && "text-dim",
                  )}
                >
                  {plan.label}
                </Body>
                <Chevron />
              </View>
            }
            onPress={onOpenSubscription}
          />
          <Row
            icon={<BadgeCheckIcon size={18} color={tokens.silver} />}
            title="Verification"
            sub="Identity check for a naira account"
            right={<Chevron />}
            onPress={onOpenVerification}
            last
          />
        </Group>

        {/* ------------------------------------------------------ security */}
        <Group title="Security" className="mt-[26px]">
          <Row
            icon={<ShieldCheckIcon size={18} color={tokens.silver} />}
            title={`${bio.label} unlock`}
            sub={bioSub}
            right={
              bio.busy ? (
                <Spinner />
              ) : (
                <Toggle
                  value={bio.enabled}
                  disabled={!bio.available}
                  onValueChange={(next) => bio.onToggle?.(next)}
                  accessibilityLabel={`${bio.label} unlock`}
                />
              )
            }
          />
          <Row
            icon={<KeyIcon size={18} color={tokens.silver} />}
            title="Transaction PIN"
            sub="Required for money-out"
            right={<Chevron />}
            onPress={onOpenPin}
          />
          <Row
            icon={<LockIcon size={18} color={tokens.silver} />}
            title="Lock now"
            sub={`Locks itself after ${lockAfterLabel} away`}
            right={<Chevron />}
            onPress={onLockNow}
            last
          />
        </Group>

        {/* ------------------------------------------------------- privacy */}
        <Group title="Privacy" className="mt-[26px]">
          <Row
            icon={<EyeOffIcon size={18} color={tokens.silver} />}
            title="Hide balances"
            sub="Covers the figures on the home screen"
            right={
              <Toggle
                value={masked}
                onValueChange={() => onToggleMasked?.()}
                accessibilityLabel="Hide balances"
              />
            }
            last
          />
        </Group>

        {/* ---------------------------------------------------- appearance */}
        <Label className="mt-[26px]">Appearance</Label>
        <Card className="mt-[10px] px-[16px] py-[2px]">
          <ThemePicker value={theme} onChange={onChangeTheme} />
        </Card>

        {/* ------------------------------------------------------- support */}
        <Group title="Support" className="mt-[26px]">
          <Row
            icon={<LifeRingIcon size={18} color={tokens.silver} />}
            title="Help & support"
            sub="Not wired up in this build"
            right={<SoonChip />}
            dead
          />
          <Row
            icon={<DocIcon size={18} color={tokens.silver} />}
            title="Terms & privacy"
            sub="Not linked yet"
            right={<SoonChip />}
            dead
            last
          />
        </Group>

        {/* ---------------------------------------------------------- exit */}
        <View className="mt-7">
          <OutlineButton
            label={signingOut ? "Signing out…" : "Sign out"}
            color={C.down}
            height={50}
            onPress={signingOut ? undefined : onSignOut}
          />
          <Text className="mt-3 text-center font-body text-[11.5px] leading-4 text-silver-muted">
            Your PIN stays on this phone — sign back in and you’re straight in.
          </Text>
        </View>

        {onSwitchAccount ? (
          <Pressable
            onPress={signingOut ? undefined : onSwitchAccount}
            accessibilityRole="button"
            accessibilityLabel="Switch account"
            className="mt-4 self-center px-3 py-2"
          >
            <Text className="font-body-medium text-[13px] text-silver underline">
              Switch account
            </Text>
          </Pressable>
        ) : null}

        <Text className="mt-[18px] text-center font-mono text-[9.5px] tracking-[1.2px] text-dim">
          KASHPLUS {version} · KEYS SPLIT THREE WAYS
        </Text>
      </Screen>
    </View>
  );
}
