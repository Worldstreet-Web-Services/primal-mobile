import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { C } from "../theme/tokens";

export interface IconProps {
  size?: number;
  color?: string;
  /** Filled variant — used for the active tab. */
  filled?: boolean;
  strokeWidth?: number;
}

/** Long arrow used on the media rows (podcast / news). */
export function ArrowRight({
  size = 34,
  color = C.text,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 34 21" fill="none">
      <Path
        d="M1 10.5h31M23 1.5l9 9-9 9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BellIcon({
  size = 18,
  color = C.brandInk,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 0 0-6 6c0 3.1-.7 5-1.5 6.1-.4.6 0 1.4.8 1.4h13.4c.8 0 1.2-.8.8-1.4C18.7 14 18 12.1 18 9a6 6 0 0 0-6-6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M9.7 20a2.4 2.4 0 0 0 4.6 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HomeIcon({
  size = 22,
  color = C.silver,
  filled,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10.4 12 3.6l8.5 6.8V19a1.6 1.6 0 0 1-1.6 1.6H5.1A1.6 1.6 0 0 1 3.5 19v-8.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? color : "none"}
        fillOpacity={filled ? 0.22 : 0}
      />
      <Path
        d="M9.6 20.6v-5.3h4.8v5.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export function ChartIcon({
  size = 22,
  color = C.silver,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.4 16.6 9 10.9l3.4 3.4L20.6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.4 6h5.2v5.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Stacked layers — the "Pulse" feed. */
export function LayersIcon({
  size = 22,
  color = C.silver,
  filled,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.2 21 8l-9 4.8L3 8l9-4.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? color : "none"}
        fillOpacity={filled ? 0.22 : 0}
      />
      <Path
        d="M3 12.4 12 17.2l9-4.8M3 16.6 12 21.4l9-4.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PersonIcon({
  size = 22,
  color = C.silver,
  filled = true,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={8}
        r={3.7}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={filled ? color : "none"}
      />
      <Path
        d="M4.6 20.4c.6-3.9 3.7-6.2 7.4-6.2s6.8 2.3 7.4 6.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill={filled ? color : "none"}
      />
    </Svg>
  );
}

export function PlusIcon({
  size = 14,
  color = C.brandSoftInk,
  strokeWidth = 2.2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Small rising arrow used inside the gain pill. */
export function TrendUpIcon({
  size = 13,
  color = C.up,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 17.5 9.5 11l3.6 3.6L20.5 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.4 6.6h5.2v5.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ClockIcon({
  size = 13,
  color = C.dim,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={12}
        r={8.6}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M12 7.4V12l3.2 2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Four-point sparkle — marks the "hold" CTA as the considered action. */
export function SparkleIcon({ size = 16, color = C.brandSoftInk }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2.5c.9 4.6 2.4 6.1 7 7-4.6.9-6.1 2.4-7 7-.9-4.6-2.4-6.1-7-7 4.6-.9 6.1-2.4 7-7Z"
        fill={color}
      />
      <Path
        d="M5.6 14.4c.4 2 1.1 2.7 3.1 3.1-2 .4-2.7 1.1-3.1 3.1-.4-2-1.1-2.7-3.1-3.1 2-.4 2.7-1.1 3.1-3.1Z"
        fill={color}
      />
    </Svg>
  );
}

/** Wallet — the self-custody funding route. */
export function WalletIcon({
  size = 22,
  color = C.text,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.2 8.4a2.2 2.2 0 0 1 2.2-2.2h11.2a2.2 2.2 0 0 1 2.2 2.2v7.2a2.2 2.2 0 0 1-2.2 2.2H5.4a2.2 2.2 0 0 1-2.2-2.2V8.4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M3.2 9.6V7.2c0-.9.6-1.6 1.5-1.8l9.3-1.6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.4 12h3.4"
        stroke={color}
        strokeWidth={strokeWidth + 0.4}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Classical bank front — the local rails. */
export function BankIcon({
  size = 22,
  color = C.text,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9.4 12 4l9 5.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.6 10.4v7.2M10 10.4v7.2M14 10.4v7.2M18.4 10.4v7.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M3.6 20.2h16.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CloseIcon({
  size = 18,
  color = C.text,
  strokeWidth = 1.9,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6 6 18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChevronDownIcon({
  size = 16,
  color = C.silver,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m6 9.5 6 6 6-6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Two offset sheets — the copy affordance on an address field. */
export function CopyIcon({
  size = 17,
  color = C.silver,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 9.2a2 2 0 0 1 2-2h6.8a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9.2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M15.6 7.2V8a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2H13"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        transform="translate(0.8 -1.2)"
      />
    </Svg>
  );
}

export function CheckIcon({
  size = 17,
  color = C.brand,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Exclamation in a ring — the warning on an irreversible step. */
export function AlertIcon({
  size = 18,
  color = C.down,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M12 7.4v5.2"
        stroke={color}
        strokeWidth={strokeWidth + 0.3}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16.3} r={1} fill={color} />
    </Svg>
  );
}

/** Concentric arcs — the ambient ring motif behind the greeting. */
export function RingDecor({
  size = 260,
  color = C.brandSoft,
  opacity = 0.28,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      {[46, 70, 94, 118].map((r, i) => (
        <Circle
          key={r}
          cx={26}
          cy={100}
          r={r}
          stroke={color}
          strokeWidth={1}
          opacity={opacity * (1 - i * 0.18)}
        />
      ))}
    </Svg>
  );
}

/* ── Provider marks ──────────────────────────────────────────────────────────
   Sign-in buttons only. Google keeps its four official colors — its brand
   guidelines forbid recoloring it — so unlike everything above, these two take
   no `color`. */

/** Google's "G", in its mandated four-color form. */
export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.93l3.66-2.83z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
        fill="#EA4335"
      />
    </Svg>
  );
}

/** Apple's mark. Sits on dark chrome, so it renders in white. */
export function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M17.05 12.54c-.03-2.73 2.23-4.04 2.33-4.1-1.27-1.86-3.25-2.11-3.95-2.14-1.68-.17-3.28 1-4.13 1-.85 0-2.17-.98-3.56-.95-1.83.03-3.52 1.06-4.46 2.7-1.9 3.3-.49 8.19 1.36 10.87.9 1.31 1.98 2.78 3.4 2.73 1.36-.06 1.88-.88 3.53-.88 1.65 0 2.11.88 3.55.85 1.47-.03 2.4-1.33 3.3-2.65 1.04-1.52 1.47-2.99 1.5-3.07-.03-.01-2.87-1.1-2.9-4.36zM14.4 4.6c.75-.91 1.25-2.17 1.11-3.43-1.08.04-2.38.72-3.15 1.62-.69.8-1.29 2.08-1.13 3.31 1.2.09 2.43-.61 3.17-1.5z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}

/**
 * KingsChat: a speech bubble carrying a crown. Redrawn to the system's stroke
 * weight rather than dropped in as artwork, so swap in the official asset if
 * brand assets ever land in the repo.
 */
export function KingsChatMark({
  size = 20,
  color = C.brandSoftInk,
  strokeWidth = 1.6,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.6c4.7 0 8.4 3.05 8.4 6.9 0 3.85-3.7 6.9-8.4 6.9-.86 0-1.7-.1-2.48-.29L5.4 20.4l.9-3.6C4.5 15.55 3.6 13.55 3.6 11.4c0-3.85 3.7-7.8 8.4-7.8z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M8.6 12.6 7.9 8.9l2.35 1.85L12 8.1l1.75 2.65L16.1 8.9l-.7 3.7H8.6z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Paper plane — "send this somewhere", the Transfer action on the hero card. */
export function SendIcon({
  size = 19,
  color = C.text,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.2 3.4 2.9 10.1c-.8.3-.8 1.4 0 1.7l7.2 2.5 2.5 7.2c.3.8 1.4.8 1.7 0l6.7-18.3a.9.9 0 0 0-1.1-1.1Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={color === "none" ? "none" : "transparent"}
      />
      <Path
        d="m10.1 14.3 4.2-4.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Folded newspaper — the News tab. */
export function NewsIcon({
  size = 22,
  color = C.silver,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.4h11.4a1 1 0 0 1 1 1v12.2H5a1 1 0 0 1-1-1V5.4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M16.4 9.2h2.6a1 1 0 0 1 1 1v7.2a1.2 1.2 0 0 1-2.4 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M6.9 8.7h6.6M6.9 12h6.6M6.9 15.3h4"
        stroke={color}
        strokeWidth={strokeWidth - 0.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Cogwheel — the Settings tab. Twelve teeth drawn as one path rather than a
 * dozen rotated rects: at 22pt the rects land on fractional pixels and the
 * wheel reads lopsided on Android.
 *
 * SIZED TO THE ROW, NOT TO THE BOX. The tab bar puts this beside `HomeIcon`,
 * `NewsIcon` and `MicIcon` at one point size, and what a viewer compares is
 * how big each MARK looks — not how big its viewBox is. Drawn at its natural
 * extent this wheel filled 78% of the box against Home's 71% and the first cut
 * of the newspaper's 55%, so the row read as three different icon sizes and no
 * amount of centring could fix it. The outline is therefore scaled to 17 of 24,
 * centred on 12, which is Home's extent to the unit.
 */
export function GearIcon({
  size = 22,
  color = C.silver,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5L13.54 5.22L15.8 4.68L16.43 6.94L18.6 7.84L18.06 10.1L19.6 11.82L18.06 13.54L18.6 15.8L16.43 16.7L15.8 18.96L13.54 18.42L12 20.5L10.46 18.78L8.2 19.32L7.57 17.06L5.4 16.16L5.94 13.9L4.4 12L5.94 10.28L5.4 8.02L7.57 7.12L8.2 4.86L10.46 5.4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle
        cx={12}
        cy={12}
        r={2.9}
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}

/**
 * Microphone on its stand — the Podcast tab.
 *
 * Sized to the row and not to the box, for the reason spelled out on
 * `GearIcon`: the mark spans 17 of 24 centred on 12, which is what `HomeIcon`
 * and `NewsIcon` occupy, so the four tabs read as one size.
 */
export function MicIcon({
  size = 22,
  color = C.silver,
  filled,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5a2.6 2.6 0 0 1 2.6 2.6v5.4a2.6 2.6 0 0 1-5.2 0V6.1A2.6 2.6 0 0 1 12 3.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill={filled ? color : "none"}
        fillOpacity={filled ? 0.22 : 0}
      />
      <Path
        d="M6.6 11a5.4 5.4 0 0 0 10.8 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M12 16.4v4.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Solid play triangle — the affordance on a media card. */
export function PlayIcon({ size = 18, color = C.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 3.6 21 12 6 20.4V3.6z" fill={color} />
    </Svg>
  );
}

/** Mirror of `TrendUpIcon` — a short position, a loss, a falling series. */
export function TrendDownIcon({
  size = 13,
  color = C.down,
  strokeWidth = 2,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 6.5 9.5 13l3.6-3.6L20.5 17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.4 17.4h5.2v-5.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Filled star — the rating mark beside a trader's name. Solid rather than
 * outlined: at 13pt an outlined star closes up into a blob on Android.
 */
export function StarIcon({ size = 13, color = C.amber }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.6l2.94 5.96 6.56.96-4.75 4.63 1.12 6.55L12 17.6l-5.87 3.1 1.12-6.55L2.5 9.52l6.56-.96L12 2.6Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Two figures — a COUNT of people. `PersonIcon` is the single account (the
 * profile page, reached from the greeting portrait); this one is "the traders you copy", which is a set.
 */
export function UsersIcon({
  size = 20,
  color = C.silver,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={9.4}
        cy={8.2}
        r={3.4}
        stroke={color}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M3.6 19.2c0-3.1 2.6-5.1 5.8-5.1s5.8 2 5.8 5.1"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M16.4 5.2a3.4 3.4 0 0 1 0 6M17.6 14.4c2.1.5 3.4 2.2 3.4 4.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** The disclosure chevron on a row that opens something. */
export function ChevronRightIcon({
  size = 18,
  color = C.silver,
  strokeWidth = 1.8,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9.5 6 6 6-6 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Shield with a tick — "you are protected". Used on the reassurance note under
 * a commitment, never as a status: it says the guard exists, not that it fired.
 */
export function ShieldCheckIcon({
  size = 18,
  color = C.brand,
  strokeWidth = 1.7,
}: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.8 4.8 5.6v5.9c0 4.2 2.9 8 7.2 9.7 4.3-1.7 7.2-5.5 7.2-9.7V5.6L12 2.8Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="m8.9 11.9 2.2 2.2 4-4.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Overflow affordance — the header's "more" target. */
export function MoreIcon({ size = 20, color = C.text }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={5} cy={12} r={1.85} fill={color} />
      <Circle cx={12} cy={12} r={1.85} fill={color} />
      <Circle cx={19} cy={12} r={1.85} fill={color} />
    </Svg>
  );
}
