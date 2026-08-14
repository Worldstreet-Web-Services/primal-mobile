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
  color = C.limeInk,
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
  color = C.leafInk,
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
      <Circle cx={12} cy={12} r={8.6} stroke={color} strokeWidth={strokeWidth} />
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
export function SparkleIcon({ size = 16, color = C.leafInk }: IconProps) {
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

/** Concentric arcs — the ambient ring motif behind the greeting. */
export function RingDecor({
  size = 260,
  color = C.leaf,
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
