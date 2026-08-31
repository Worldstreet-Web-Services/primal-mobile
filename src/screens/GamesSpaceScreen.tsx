import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Easing, View, Text } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { C, withAlpha } from "../theme/tokens";
import {
  Screen,
  PressableScale,
  PrimaryButton,
  Pulse,
  PulseDot,
  Shine,
  Mono,
  Body,
  Display,
  Label,
} from "../components/ui";
import { useVaultActions } from "../hooks/useWager";
import type { Money } from "../lib/vault/api";
import {
  firstUnitUsd,
  formatClock,
  formatUsd,
  moneyFromWei,
  PLAY_TARGET_USD,
  truncateAddress,
} from "../lib/vault/format";
import { vaultSigner } from "../lib/vault/signer";
import { readPendingWithdrawals } from "../lib/vault/wager";
import { featuredGame, useVaultStore } from "../store/vault";
import { cn } from "@/lib/cn";

// Design 3c: games space — the flagship card, the claim banner, then the
// floor's quieter rooms.
//
// EVERY FIGURE ON THIS SCREEN IS READ, NOT WRITTEN. The card shipped with a
// hardcoded $1,240 pot under a pulsing LIVE pill, a 04:32 clock that never
// moved, a "@tobi" standing, an $85 games balance and a $920 winnings banner
// behind a CLAIM button with no handler. All of it was invented, and the
// winnings line invented money the user was then invited to collect. The pot,
// clock, standing and round number now come off the vault store — the same
// rows LastManScreen reads — the claim banner comes from the contract's own
// pendingWithdrawals and its button performs a real claim, and the games
// balance is gone: there is no such account anywhere in the vault, so there
// was nothing to wire it to.

/** Rooms that aren't open yet. They recede — full surface, no dashed edge,
 *  a seal instead of a fake player count. */
const soonRooms = [
  { name: "Chess", note: "Rated tables, private stakes", glyph: "♞" },
  { name: "Checkers", note: "Short rounds, house rules", discs: true },
];

/**
 * A vault Money as one short line.
 *
 * The gateway prices its own quotes, and when it has not priced one yet the
 * USD side is 0 — which over a real pot would read as an empty table. The ETH
 * figure is the truth underneath either way, so it stands in rather than a
 * zero standing in for it.
 */
function shortMoney(m: Money): string {
  if (m.usdValue > 0) {
    return m.usdValue >= 100
      ? `$${Math.round(m.usdValue).toLocaleString("en-US")}`
      : formatUsd(m.usdValue);
  }
  const eth = parseFloat(m.amount);
  return eth > 0 && isFinite(eth) ? `${Number(eth.toPrecision(3))} ETH` : "$0";
}

function Seal({ label }: { label: string }) {
  return (
    <View className="px-[9px] py-[5px] rounded-[999px] border border-rule bg-canvas-inset">
      <Mono className="text-[8.5px] text-dim tracking-[1.6px]">{label}</Mono>
    </View>
  );
}

/** The room's own state, in the header pill. The pulse is reserved for a game
 *  that is genuinely running — it is a claim, not a decoration. */
function StatePill({ live, label }: { live: boolean; label: string }) {
  return (
    <View className="flex-row items-center gap-[7px] px-[11px] py-[6px] rounded-[999px] border border-rule bg-canvas-inset">
      {live ? (
        <PulseDot color={C.live} size={5} />
      ) : (
        <View className="w-[5px] h-[5px] rounded-[3px] bg-dim" />
      )}
      <Mono
        size={9.5}

        className={cn("tracking-[1.6px]", live ? "text-silver" : "text-dim")}
      >
        {label}
      </Mono>
    </View>
  );
}

/** One column of the flagship's stat strip. `null` prints nothing at all —
 *  an omitted figure is the honest answer, a placeholder one is not. */
function Stat({
  k,
  v,
  amber,
  first,
}: {
  k: string;
  v: string | null;
  amber?: boolean;
  first?: boolean;
}) {
  return (
    <View
      className="flex-1"
      style={{
        paddingLeft: first ? 0 : 14,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: C.hairline,
      }}
    >
      <Mono className="text-[9px] text-dim tracking-[1.6px]">{k}</Mono>
      {v === null ? (
        <Pulse width="70%" height={14} radius={5} style={{ marginTop: 7 }} />
      ) : (
        // `Mono`, not a bare Text: the clock redraws every second and tabular
        // numerals are what stop it shifting width as its digits change.
        <Mono
          size={16}

          className={cn(
            "mt-[6px] font-mono-semibold",
            amber ? "text-amber" : "text-text",
          )}
        >
          {v}
        </Mono>
      )}
    </View>
  );
}

function SoonRoom({
  name,
  note,
  glyph,
  discs,
}: {
  name: string;
  note: string;
  glyph?: string;
  discs?: boolean;
}) {
  return (
    <View className="flex-1 rounded-[20px] bg-canvas-raised border border-rule p-[16px] overflow-hidden">
      <Shine />
      {/* A ghost of the game's mark, low enough to read as material. */}
      {glyph ? (
        <Text
          pointerEvents="none"
          className="absolute right-[-14px] bottom-[-30px] text-[104px] leading-[116px] text-silver"
          style={{
            // 0.05 was mixed against the near-black card, where 5% silver still
            // doubled the local value. On the charcoal card the ground has come
            // most of the way up to meet it, so the same alpha lifts almost
            // nothing and the ghost disappears. Roughly doubled to hold it.
            opacity: 0.09,
          }}
        >
          {glyph}
        </Text>
      ) : null}
      {discs ? (
        <View
          pointerEvents="none"
          className="absolute right-[-26px] bottom-[-26px] flex-row opacity-[0.05]"
        >
          <View className="w-[84px] h-[84px] rounded-[42px] bg-silver" />
          <View
            className="w-[84px] h-[84px] rounded-[42px] ml-[-28px] border-silver"
            style={{
              borderWidth: 6,
            }}
          />
        </View>
      ) : null}
      <View className="flex-row items-center justify-between">
        {discs ? (
          <View className="flex-row">
            <View className="w-[20px] h-[20px] rounded-[10px] bg-silver opacity-[0.55]" />
            <View className="w-[20px] h-[20px] rounded-[10px] ml-[-7px] bg-canvas-inset border border-border" />
          </View>
        ) : (
          <Text className="text-[20px] leading-[24px] text-silver">
            {glyph}
          </Text>
        )}
        <Seal label="SOON" />
      </View>
      <Body className="text-[14px] text-silver font-body-semibold mt-[24px]">
        {name}
      </Body>
      <Body className="text-[10.5px] text-dim mt-[4px] leading-[15px]">
        {note}
      </Body>
    </View>
  );
}

export default function GamesSpaceScreen({
  onOpenGame,
  top = 0,
}: {
  onOpenGame?: (slug: string) => void;
  /** Head space for the floating nav header. */
  top?: number;
}) {
  const games = useVaultStore((s) => s.games);
  const winners = useVaultStore((s) => s.winners);
  const loading = useVaultStore((s) => s.loading);
  const error = useVaultStore((s) => s.error);
  const connected = useVaultStore((s) => s.connected);
  const featuredId = useVaultStore((s) => s.featuredId);
  const start = useVaultStore((s) => s.start);
  const stop = useVaultStore((s) => s.stop);
  const refresh = useVaultStore((s) => s.refresh);

  const { claim, claiming, error: claimError, clearError } = useVaultActions();

  // The feed, for as long as this screen is mounted.
  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  // Re-arm after something else tore the feed down. `start`/`stop` are one
  // global pair, and LastManScreen stops the store when it unmounts — which
  // lands AFTER this screen has already been given focus back, leaving the card
  // frozen on its last snapshot. Watching `connected` catches that without
  // racing it; `start` is a no-op while the store is already running, so this
  // cannot loop.
  useEffect(() => {
    if (!connected) start();
  }, [connected, start]);

  // The screen's one motion moment: the flagship settles into place.
  const enter = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      delay: 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const featured = featuredGame(games, featuredId);

  // The clock is derived from the game's on-chain endTime (wall clock), so it
  // survives a backgrounded phone; this only samples the clock to redraw.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!featured) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [featured]);

  /* ------------------------------------------------------ pending winnings */

  const [myAddress, setMyAddress] = useState<string | null>(null);
  useEffect(() => {
    // The stub signer throws until auth lands — a screen with no wallet simply
    // has no winnings line.
    vaultSigner
      .getAddress()
      .then(setMyAddress)
      .catch(() => {});
  }, []);

  /** `null` until the contract has answered. Never assumed to be zero. */
  const [pendingWei, setPendingWei] = useState<string | null>(null);
  const checkPending = useCallback(() => {
    if (!myAddress) return;
    readPendingWithdrawals(myAddress as `0x${string}`)
      .then((wei) => setPendingWei(wei.toString()))
      .catch(() => {});
  }, [myAddress]);
  useEffect(checkPending, [checkPending]);

  const handleClaim = async () => {
    if (claiming) return;
    clearError();
    const hash = await claim();
    if (hash) {
      setPendingWei("0");
      checkPending(); // confirm against the chain
    }
  };

  /* ------------------------------------------------------------- what to say */

  const openLastMan = () => onOpenGame && onOpenGame("last-man");

  /** ETH/USD from whatever the gateway has already priced. 0 when nothing has. */
  const unit = firstUnitUsd([
    ...games.flatMap((g) => [g.pot, g.minWager]),
    ...winners.flatMap((w) => [w.toWinner, w.pot]),
  ]);

  const reading = loading && games.length === 0 && !error;
  const unreadable = error && games.length === 0;
  const secondsLeft = featured ? Math.max(0, featured.endTime - now / 1000) : 0;
  const running = !!featured && secondsLeft > 0;

  const pillLabel = unreadable
    ? "FLOOR UNREADABLE"
    : reading
      ? "READING THE FLOOR"
      : featured
        ? running
          ? "LIVE"
          : "SETTLING"
        : "NO TABLE OPEN";

  const kicker = featured ? `FLAGSHIP · GAME #${featured.gameId}` : "FLAGSHIP";

  // A stake is only quoted when there is a game whose stake we have read. With
  // no table open, the honest number is what KashPlus charges to open one.
  const primaryLabel = featured
    ? `Enter the round · ${shortMoney(featured.minWager)}`
    : `Open a table · $${PLAY_TARGET_USD}`;

  const pendingMoney =
    pendingWei === null ? null : moneyFromWei(pendingWei, unit);
  const hasPending = pendingWei !== null && BigInt(pendingWei) > 0n;

  return (
    <Screen top={top}>
      {/* No "games balance" line: the vault has no per-user balance to read.
          The row that used to sit here printed $85.00, which was never
          anything. */}

      {/* Won money wears the up tone — it is yours already, not at stake. It
          appears only when the contract says there is some. */}
      {hasPending && pendingMoney ? (
        <View
          className="mt-[18px] flex-row items-center gap-[14px] rounded-[20px] border bg-up-tint py-[15px] px-[16px]"
          style={{
            borderColor: withAlpha(C.up, 0.26),
          }}
        >
          <View className="flex-1">
            <Mono className="text-[9.5px] text-up tracking-[1.8px] opacity-[0.75]">
              YOUR WINNINGS
            </Mono>
            <Mono className="text-[20px] text-up mt-[5px] font-mono-semibold">
              {unit > 0
                ? pendingMoney.formattedUsd
                : `${pendingMoney.amount} ETH`}
            </Mono>
            <Body className="text-[11px] text-dim mt-[4px]">
              A payout that couldn&apos;t reach you. Claim to collect it.
            </Body>
            {claimError ? (
              <Body className="text-[11px] text-down mt-[6px] leading-[16px]">
                {claimError}
              </Body>
            ) : null}
          </View>
          <PressableScale onPress={() => void handleClaim()} scale={0.96}>
            <View
              accessibilityRole="button"
              accessibilityLabel="Claim winnings"
              className="rounded-[999px] border py-[10px] px-[18px]"
              style={{
                borderColor: withAlpha(C.up, 0.45),
                backgroundColor: withAlpha(C.up, 0.12),
                opacity: claiming ? 0.6 : 1,
              }}
            >
              <Text className="font-mono-semibold text-[11.5px] tracking-[1.4px] text-up">
                {claiming ? "CLAIMING…" : "CLAIM"}
              </Text>
            </View>
          </PressableScale>
        </View>
      ) : null}

      <View className="flex-row items-center gap-[10px] mt-[26px] mb-[12px]">
        <Label className="tracking-[2.4px]">THE FLOOR</Label>
        <View className="flex-1 h-[1px] bg-rule" />
      </View>

      <Animated.View
        style={{
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        }}
      >
        <PressableScale onPress={openLastMan} scale={0.985}>
          <View className="rounded-[26px] bg-canvas-raised border border-border p-[20px] overflow-hidden">
            <Shine />
            <Svg
              pointerEvents="none"
              width="100%"
              height="100%"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <Defs>
                <RadialGradient
                  id="floorLight"
                  cx="78%"
                  cy="4%"
                  rx="70%"
                  ry="60%"
                >
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.09} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#floorLight)"
              />
            </Svg>
            <View className="flex-row justify-between items-center">
              <Mono className="text-[9.5px] text-sub tracking-[2px]">
                {kicker}
              </Mono>
              <StatePill live={running} label={pillLabel} />
            </View>
            <Display className="text-[28px] leading-[29.4px] mt-[14px] leading-[32px]">
              {"The Last Man\nStanding"}
            </Display>

            {/* The stat strip only exists when there is a game behind it.
                Reading → skeletons. Nothing open, or nothing readable → a
                sentence, because three dashes read as three figures. */}
            {featured ? (
              <View className="mt-[18px] pt-[14px] flex-row border-t border-t-rule">
                <Stat k="POT" v={shortMoney(featured.pot)} first />
                <Stat
                  k="CLOCK"
                  v={running ? formatClock(secondsLeft) : "—"}
                  amber={running}
                />
                <Stat k="STANDING" v={truncateAddress(featured.king)} />
              </View>
            ) : reading ? (
              <View className="mt-[18px] pt-[14px] flex-row border-t border-t-rule">
                <Stat k="POT" v={null} first />
                <Stat k="CLOCK" v={null} />
                <Stat k="STANDING" v={null} />
              </View>
            ) : (
              <View className="mt-[18px] pt-[14px] border-t border-t-rule">
                <Body className="text-[12px] text-dim leading-[18px]">
                  {unreadable
                    ? "KashPlus could not reach the vault, so there is no pot or clock to show. Open the room to try again."
                    : "No pot on the table right now. Open one and the clock starts with you."}
                </Body>
              </View>
            )}

            <View className="mt-[18px]">
              <PrimaryButton
                label={primaryLabel}
                height={50}
                radius={16}
                uppercase={false}
                color={C.brand}
                onPress={openLastMan}
              />
            </View>
            <Body className="text-[11px] text-dim mt-[12px] leading-[16.5px]">
              Pay in, take the lead, reset the clock. Outlast the table and the
              pot is yours.
            </Body>
          </View>
        </PressableScale>
      </Animated.View>

      {unreadable ? (
        <PressableScale onPress={() => void refresh()} scale={0.98}>
          <View className="mt-[14px] self-start py-[6px]">
            <Mono className="text-[10px] text-silver tracking-[1.4px]">
              TRY AGAIN
            </Mono>
          </View>
        </PressableScale>
      ) : null}

      <View className="flex-row items-center gap-[10px] mt-[26px] mb-[12px]">
        <Label className="tracking-[2.4px]">OPENING SOON</Label>
        <View className="flex-1 h-[1px] bg-rule" />
      </View>
      <View className="flex-row gap-[12px]">
        {soonRooms.map((r) => (
          <SoonRoom
            key={r.name}
            name={r.name}
            note={r.note}
            glyph={r.glyph}
            discs={r.discs}
          />
        ))}
      </View>

      <View className="mt-[26px] items-center gap-[10px]">
        <View className="w-[32px] h-[1px] bg-rule" />
        <Mono className="text-[9.5px] text-dim text-center tracking-[1.5px] mb-[8px]">
          SETTLED ON-CHAIN · SIGNED WITH FACE ID
        </Mono>
      </View>
    </Screen>
  );
}
