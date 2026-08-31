import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/home/ProfileHeader";
import { ShieldCheckIcon } from "@/components/icons";
import {
  Body,
  Display,
  KeyValueList,
  Label,
  MetalButton,
  Mono,
  Screen,
  Toggle,
} from "@/components/ui";
import { money, moneyShort } from "@/lib/format";
import {
  defaultInvestment,
  investPresets,
  safetyStopRatio,
  traderStats,
  type Trader,
} from "@/data/traders";
import { C, withAlpha } from "@/theme/tokens";
import { cn } from "@/lib/cn";

/** Clears the pinned action bar so the note above it is never trapped under it. */
const BAR_SPACE = 96;

/** Keeps a typed stake to digits and one decimal point. */
function sanitize(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

/** One figure under its name — the three columns across the top. */
function HeadlineStat({
  label,
  value,
  color = C.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View className="flex-1">
      <Label>{label}</Label>
      <Display className="text-[22px] leading-[23.1px] mt-[6px]" color={color}>
        {value}
      </Display>
    </View>
  );
}

/** One boxed figure in the statistics grid. */
function StatTile({
  label,
  value,
  color = C.text,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    // Half the row minus half the gap — a two-up grid without a grid.
    <View className="w-[48.5%] rounded-2xl border border-rule bg-card p-3.5">
      <Body className="text-[12.5px] text-dim">{label}</Body>
      <Mono className="text-[17px] mt-[6px]" color={color}>
        {value}
      </Mono>
    </View>
  );
}

/** A titled card — the three blocks this page is built from. */
function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4 rounded-3xl border border-rule bg-canvas-raised p-4">
      {title ? (
        <Body className="text-[17px] font-body-semibold mb-[14px]">
          {title}
        </Body>
      ) : null}
      {children}
    </View>
  );
}

export interface TraderProfileScreenProps {
  trader: Trader;
  /** Stake in the account's currency. Uncontrolled unless `onAmountChange`. */
  amount?: number;
  onAmountChange?: (next: number) => void;
  /** Mirrors the leader at the stake on screen. */
  onStartCopying?: (id: string, amount: number) => void;
}

/**
 * One leader, opened: who they are, how they have traded, and the single
 * decision this page exists for — how much to put behind them.
 *
 * Everything above the invest card is a claim about the leader; everything
 * below it is a statement of what the member is about to agree to. The order
 * is deliberate — the summary restates the stake in words after it has been
 * typed in figures, because a number in a field is an edit and a number in a
 * receipt is a commitment.
 *
 * Nothing here is sourced. Worldstreet owns the copy-trading endpoints (PRD
 * §F6), so the figures come from `src/data/traders.ts` and the action returns
 * to the feed rather than mirroring anything.
 */
export default function TraderProfileScreen({
  trader,
  amount,
  onAmountChange,
  onStartCopying,
}: TraderProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const stats = traderStats(trader);

  const controlled = amount !== undefined;
  const [internal, setInternal] = useState(String(defaultInvestment));
  const typed = controlled ? String(amount) : internal;
  const value = Number(typed) || 0;

  const setTyped = (next: string) => {
    const clean = sanitize(next);
    if (!controlled) setInternal(clean);
    onAmountChange?.(Number(clean) || 0);
  };

  const [safetyStop, setSafetyStop] = useState(true);
  const stop = value * safetyStopRatio;

  return (
    <View className="flex-1 bg-canvas">
      <Screen
        pad={16}
        bottom={BAR_SPACE + insets.bottom}
        keyboardShouldPersistTaps="handled"
      >
        {/* Who ------------------------------------------------------------ */}
        <View className="flex-row items-center gap-3.5">
          <View>
            <Avatar
              source={trader.avatar}
              initial={trader.name}
              size={64}
              ringClassName="border-border"
            />
            {trader.online ? (
              <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 bg-green border-canvas" />
            ) : null}
          </View>

          <View className="flex-1">
            <Display
              className="text-[23px] leading-[24.15px]"
              numberOfLines={1}
            >
              {trader.name}
            </Display>
            <View className="mt-2 flex-row items-center gap-2">
              <View
                className={cn(
                  "h-2 w-2 rounded-full",
                  trader.online ? "bg-green" : "bg-dim",
                )}
              />
              <Body
                className={trader.online ? "text-text" : "text-dim"}
                size={14}
              >
                {trader.online ? "Live trading" : "Flat — no open positions"}
              </Body>
            </View>
          </View>
        </View>

        {/* The three claims that decide whether the rest is worth reading. */}
        <View className="mt-7 flex-row gap-3">
          <HeadlineStat label="Portfolio size" value={stats.portfolioSize} />
          <HeadlineStat
            label="Active copiers"
            value={stats.activeCopiers}
            color={C.brand}
          />
          <HeadlineStat label="Copied assets" value={stats.copiedAssets} />
        </View>

        {/* Track record ---------------------------------------------------- */}
        <Panel title="Trading Statistics">
          <View className="flex-row flex-wrap justify-between gap-y-3">
            <StatTile label="Win Rate" value={stats.winRate} color={C.brand} />
            <StatTile label="Avg. Duration" value={stats.avgDuration} />
            <StatTile
              label="Max Drawdown"
              value={stats.maxDrawdown}
              color={C.down}
            />
            <StatTile label="Total Trades" value={stats.totalTrades} />
          </View>
        </Panel>

        {/* The stake -------------------------------------------------------- */}
        <Panel title="How much do you want to invest?">
          <View className="flex-row gap-2">
            {investPresets.map((preset) => {
              const active = value === preset;
              return (
                // Solid brand when chosen — this is a choice, not a filter, so
                // the selected pill has to read as committed rather than merely
                // highlighted.
                <Pressable
                  key={preset}
                  onPress={() => setTyped(String(preset))}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={cn(
                    "flex-1 items-center rounded-full py-2.5 border",
                    active ? "border-brand" : "border-border",
                  )}
                  style={{
                    backgroundColor: active ? C.brand : "transparent",
                  }}
                >
                  <Body
                    className={active ? "text-brand-soft-ink" : "text-silver"}
                    semibold
                    size={13.5}
                  >
                    {`$${preset}`}
                  </Body>
                </Pressable>
              );
            })}
          </View>

          {/* The field the presets write into — they are a shortcut to it, not
              an alternative to it, so a tapped preset shows up here too. */}
          <View
            className="mt-3.5 flex-row items-center rounded-full px-5 h-[58px] border border-brand"
            style={{
              backgroundColor: C.card,
            }}
          >
            <Display className="text-[20px] leading-[21px] text-brand">
              $
            </Display>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={C.placeholder}
              accessibilityLabel="Amount to invest"
              selectionColor={C.brand}
              // Font, size and colour are text properties with no class
              // equivalent on a native input; the box around it is all classes.
              className="flex-1 ml-[10px] text-text font-display text-[20px]"
            />
            <Body className="text-[14px] text-dim">USD</Body>
          </View>

          <Body className="text-[12.5px] text-dim mt-[12px]">
            You can change this anytime.
          </Body>
        </Panel>

        {/* The floor under it ---------------------------------------------- */}
        <Panel>
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Body className="text-[15px] font-body-semibold">
                {`Stop if my investment drops below ${moneyShort(stop)}`}
              </Body>
              <Body className="text-[12.5px] text-dim mt-[3px]">
                A safety net to protect your money.
              </Body>
            </View>
            <Toggle
              value={safetyStop}
              onValueChange={setSafetyStop}
              accessibilityLabel="Stop copying if the investment falls to the safety stop"
            />
          </View>
        </Panel>

        {/* What was just agreed to, in words. */}
        <KeyValueList
          className="mt-[16px]"
          rows={[
            {
              label: "Your investment",
              value: money(value),
              valueColor: C.brand,
            },
            { label: "Copying", value: trader.name },
            {
              label: "Safety stop",
              value: safetyStop ? `At ${money(stop)}` : "Off",
              valueColor: safetyStop ? C.text : C.dim,
            },
          ]}
        />

        <View className="mt-4 flex-row items-center gap-3 rounded-2xl p-4 border border-brand bg-brand-glow">
          <View
            className="h-9 w-9 items-center justify-center rounded-full"
            // A step stronger than the box it sits on, or the disc disappears
            // into it and the glyph looks unplaced.
            style={{ backgroundColor: withAlpha(C.brand, 0.16) }}
          >
            <ShieldCheckIcon size={18} color={C.brand} />
          </View>
          <Body className="text-[13.5px] text-brand flex-1 leading-[19px]">
            You&apos;re always in control. Pause or stop anytime from your
            dashboard.
          </Body>
        </View>
      </Screen>

      {/* Pinned to the viewport: the decision has to stay reachable however far
          down the page the stats have pushed it. */}
      <View
        className="absolute left-4 right-4"
        style={{ bottom: Math.max(insets.bottom, 12) }}
      >
        <MetalButton
          label={`Start copying ${trader.name}`}
          disabled={value <= 0}
          onPress={() => onStartCopying?.(trader.id, value)}
        />
      </View>
    </View>
  );
}
