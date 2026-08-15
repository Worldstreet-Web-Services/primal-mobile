import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  Card,
  PrimaryButton,
  GhostButton,
  PressableScale,
  PulseDot,
  Shine,
  Label,
  Mono,
  Body,
  Display,
  BackChevron,
} from "../components/ui";
import { Countdown } from "../components/vault/Countdown";
import { RoundOverlay } from "../components/vault/RoundOverlay";
import { useVaultActions } from "../hooks/useWager";
import type { Money } from "../lib/vault/api";
import {
  firstUnitUsd,
  formatClock,
  formatUsd,
  moneyFromWei,
  PLAY_TARGET_USD,
  timeAgo,
  truncateAddress,
} from "../lib/vault/format";
import { vaultSigner } from "../lib/vault/signer";
import {
  readGameStatus,
  readPendingWithdrawals,
  warmSendPath,
  warmSponsorEndpoints,
} from "../lib/vault/wager";
import { featuredGame, useVaultStore } from "../store/vault";

// Design 3d preview figures — what the screen shows while the vault gateway
// can't be reached, so demos still have a round to look at. Tagged OFFLINE
// PREVIEW on screen; never rendered once real data has landed.
const preview = {
  pot: "$1,240",
  clock: "04:32",
  king: "@tobi",
  kingInitials: "TO",
  kingSub: "Took the crown 28s ago · 14th wager this round",
};

/** ETH figure secondary to the USD-first labels; null when unpriceable. */
function ethLabel(m: Money): string | null {
  const v = parseFloat(m.amount);
  return v > 0 && isFinite(v) ? `${Number(v.toPrecision(3))} ETH` : null;
}

/** Small tracked pill in the header: what the room is doing right now. */
function StatePill({ tone, label }: { tone: "live" | "quiet"; label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: C.hairline,
        backgroundColor: C.raised,
      }}
    >
      {tone === "live" ? (
        <PulseDot color={C.live} size={5} />
      ) : (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: C.dim,
          }}
        />
      )}
      <Mono size={9.5} color={tone === "live" ? C.silver : C.dim} style={{ letterSpacing: 1.6 }}>
        {label}
      </Mono>
    </View>
  );
}

export default function LastManScreen({ onBack }: { onBack?: () => void }) {
  const games = useVaultStore((s) => s.games);
  const connected = useVaultStore((s) => s.connected);
  const loading = useVaultStore((s) => s.loading);
  const error = useVaultStore((s) => s.error);
  const activities = useVaultStore((s) => s.activities);
  const winners = useVaultStore((s) => s.winners);
  const featuredId = useVaultStore((s) => s.featuredId);
  const start = useVaultStore((s) => s.start);
  const stop = useVaultStore((s) => s.stop);
  const refresh = useVaultStore((s) => s.refresh);
  const selectGame = useVaultStore((s) => s.selectGame);
  const overlayGame = useVaultStore((s) => s.overlayGame);
  const phase = useVaultStore((s) => s.phase);
  const {
    join,
    wagering,
    startGame,
    starting,
    claim,
    claiming,
    error: actionError,
    clearError,
  } = useVaultActions();

  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [pendingWei, setPendingWei] = useState("0");
  // Bundler accepted the play; the on-chain receipt hasn't landed yet.
  const [confirming, setConfirming] = useState(false);
  // Drives the lobby rows' per-second time-left redraw.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  // The stub signer throws until auth lands — a screen without a wallet just
  // shows the lobby with nothing personal on it.
  useEffect(() => {
    vaultSigner
      .getAddress()
      .then(setMyAddress)
      .catch(() => {});
  }, []);

  // Probe the gas sponsors while the user is still reading the screen, so
  // the first wager doesn't waste its opening seconds discovering that the
  // preferred endpoint is dead.
  useEffect(() => {
    void vaultSigner
      .getAccessToken()
      .catch(() => null)
      .then((t) => warmSponsorEndpoints(t ?? ""));
  }, []);

  // Warm the chain reads a play needs (delegation, nonce) while the user is
  // still reading the screen. Purely an optimisation — every failure is
  // swallowed, and the send re-reads anything that is not ready.
  useEffect(() => {
    if (myAddress) warmSendPath(myAddress as `0x${string}`);
  }, [myAddress]);

  // Settlement pushes the payout; only a FAILED push parks money in
  // pendingWithdrawals, waiting on claim(). Read from the contract — the
  // gateway has no pending endpoint in v4.
  const checkPending = useCallback(() => {
    if (!myAddress) return;
    readPendingWithdrawals(myAddress as `0x${string}`)
      .then((wei) => setPendingWei(wei.toString()))
      .catch(() => {});
  }, [myAddress]);

  // Check on entry and again whenever a round settles.
  useEffect(checkPending, [checkPending]);
  useEffect(() => {
    if (phase.kind !== "idle") checkPending();
  }, [phase.kind, checkPending]);

  // Live data once the gateway has answered; the design-preview figures when
  // it can't be reached — tagged, so nobody mistakes a demo for a round.
  const offline = error && games.length === 0;
  const live = !offline && !loading;

  const featured = featuredGame(games, featuredId);
  const others = games.filter(
    (g) => g.active && !g.settled && g.gameId !== featured?.gameId,
  );

  useEffect(() => {
    if (!others.length) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [others.length]);

  /** ETH/USD from whatever the gateway has priced. 0 when nothing has. */
  const unit = firstUnitUsd([
    ...games.flatMap((g) => [g.pot, g.minWager]),
    ...winners.flatMap((w) => [w.toWinner, w.pot]),
  ]);

  /** Chain truth immediately after OUR confirmed action — the indexer
   * trails the chain, and waiting for it re-arms the wager button. */
  const overlayFromChain = useCallback(
    async (gameId: number) => {
      try {
        const s = await readGameStatus(gameId);
        overlayGame({
          gameId,
          starter: s.starter,
          king: s.king,
          pot: moneyFromWei(s.pot.toString(), unit),
          minWager: moneyFromWei(s.minWager.toString(), unit),
          endTime: Math.floor(Date.now() / 1000) + Number(s.timeRemaining),
          timeRemaining: Number(s.timeRemaining),
          settled: false,
          active: s.active,
        });
      } catch {
        // The refresh already in flight catches the lobby up eventually.
      }
    },
    [overlayGame, unit],
  );

  const busy = wagering || starting || confirming;

  const handleJoin = async () => {
    if (!featured || busy) return;
    clearError();
    const gameId = featured.gameId;
    const hash = await join(gameId, {
      onAccepted: () => setConfirming(true),
    });
    setConfirming(false);
    if (hash) {
      void overlayFromChain(gameId);
      void refresh();
    }
  };

  const handleStart = async () => {
    if (busy) return;
    clearError();
    const hash = await startGame(unit, {
      onAccepted: () => setConfirming(true),
    });
    setConfirming(false);
    // The started game's id lives in the receipt logs; the lobby learns it
    // when the indexer does — a refresh now and the watchdog cover the gap.
    if (hash) void refresh();
  };

  const handleClaim = async () => {
    if (claiming) return;
    clearError();
    const hash = await claim();
    if (hash) {
      setPendingWei("0");
      checkPending(); // confirm against the chain
    }
  };

  // Stage figures: featured game when live, the design preview otherwise.
  const potUsd = featured?.pot.usdValue ?? 0;
  const potLabel = live
    ? featured
      ? potUsd >= 100
        ? `$${Math.round(potUsd).toLocaleString("en-US")}`
        : formatUsd(potUsd)
      : "$0"
    : preview.pot;
  const minWagerLabel = featured ? featured.minWager.formattedUsd : `$${PLAY_TARGET_USD}`;
  // Secondary unit under the USD hero — dim, small, never the headline.
  const potEth = featured ? ethLabel(featured.pot) : null;
  // Nothing on the floor yet: a designed statement, not a $0 and a dead clock.
  const emptyTable = live && !featured;

  const kingActivity = featured
    ? activities.find(
        (a) =>
          (a.action === "joined" || a.action === "started") &&
          a.address.toLowerCase() === featured.king.toLowerCase(),
      )
    : undefined;
  const kingLabel = live
    ? featured
      ? truncateAddress(featured.king)
      : null
    : preview.king;
  const kingInitials = live
    ? featured
      ? featured.king.slice(2, 4).toUpperCase()
      : "··"
    : preview.kingInitials;
  const kingSub = live
    ? featured
      ? kingActivity
        ? `Took the crown ${timeAgo(kingActivity.createdAt)} · min wager ${featured.minWager.formattedUsd}`
        : `Min wager ${featured.minWager.formattedUsd} · started by ${truncateAddress(featured.starter)}`
      : "Start a game and wear the crown"
    : preview.kingSub;
  // The one seat that changes how this screen reads: the crown is yours.
  const iAmKing =
    !!myAddress &&
    !!featured &&
    featured.king.toLowerCase() === myAddress.toLowerCase();

  // The claim banner: real pendingWithdrawals when live, the design figure
  // in the preview. Either way the button drives the real claim action.
  const pendingMoney = moneyFromWei(pendingWei, unit);
  const hasPending = live && BigInt(pendingWei) > 0n;
  const showClaim = live ? hasPending : true;
  const claimAmount = live
    ? unit > 0
      ? pendingMoney.formattedUsd
      : `${pendingMoney.amount} ETH`
    : "$920";

  const primaryLabel = confirming
    ? "You're in, confirming…"
    : wagering
      ? "Placing your wager…"
      : starting
        ? "Opening your game…"
        : live && featured
          ? `Take the crown · ${minWagerLabel}`
          : live
            ? `Open a table · $${PLAY_TARGET_USD}`
            : `Take the crown · $${PLAY_TARGET_USD}`;
  // Joining an existing game floors at ITS minWager; starting one is where
  // Paradigm applies the $50 product stake.
  const primaryAction = live && featured ? handleJoin : handleStart;
  const minWagerEth = featured ? ethLabel(featured.minWager) : null;

  const lastWinner = winners[0];

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingTop: 10,
          }}
        >
          <Pressable onPress={onBack} hitSlop={10}>
            <BackChevron />
          </Pressable>
          <Mono size={11} color={C.sub} style={{ letterSpacing: 2.4 }}>
            THE LAST MAN
          </Mono>
          <View style={{ flex: 1 }} />
          {live ? (
            featured ? (
              <StatePill tone="live" label={`GAME #${featured.gameId}`} />
            ) : (
              <StatePill tone="quiet" label={connected ? "LOBBY" : "CONNECTING"} />
            )
          ) : (
            <StatePill tone="quiet" label="OFFLINE PREVIEW" />
          )}
        </View>

        {/* The pot under museum glass: a raised case, a pool of light behind
            the figure, and the clock sharing the same plinth. */}
        <View
          style={{
            marginTop: 26,
            borderRadius: 28,
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: C.hairline,
            overflow: "hidden",
            paddingTop: 26,
            paddingBottom: 24,
            paddingHorizontal: 20,
            alignItems: "center",
          }}
        >
          <Shine />
          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <Defs>
              <RadialGradient id="potLight" cx="50%" cy="26%" rx="62%" ry="52%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#potLight)" />
          </Svg>

          {emptyTable ? (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <Label style={{ letterSpacing: 2.6 }}>THE FLOOR IS OPEN</Label>
              <Display size={27} style={{ marginTop: 12, textAlign: "center" }}>
                {"No pot on\nthe table"}
              </Display>
              <Body
                size={12}
                color={C.dim}
                style={{
                  marginTop: 12,
                  textAlign: "center",
                  lineHeight: 18,
                  maxWidth: 260,
                }}
              >
                {`Open one with a $${PLAY_TARGET_USD} stake. The clock starts with you, and so does the crown.`}
              </Body>
            </View>
          ) : (
            <>
              <Label style={{ letterSpacing: 2.6 }}>IN THE POT</Label>
              <Svg width="100%" height={72} style={{ marginTop: 10 }}>
                <Defs>
                  <SvgGradient id="pot" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#FFFFFF" />
                    <Stop offset="1" stopColor="#A7ADB4" />
                  </SvgGradient>
                </Defs>
                <SvgText
                  x="50%"
                  y={58}
                  textAnchor="middle"
                  fontFamily={F.display}
                  fontSize={64}
                  letterSpacing={-1}
                  fill="url(#pot)"
                >
                  {potLabel}
                </SvgText>
              </Svg>
              {potEth ? (
                <Mono size={11} color={C.dim} style={{ marginTop: 2, letterSpacing: 0.6 }}>
                  {`≈ ${potEth}`}
                </Mono>
              ) : null}
              <View
                style={{
                  alignSelf: "stretch",
                  height: 1,
                  backgroundColor: C.hairline,
                  marginVertical: 22,
                }}
              />
              {live ? (
                <Countdown deadlineMs={featured ? featured.endTime * 1000 : null} />
              ) : (
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      fontFamily: F.monoSemibold,
                      fontSize: 48,
                      letterSpacing: 2,
                      color: C.amber,
                    }}
                  >
                    {preview.clock}
                  </Text>
                  <Mono
                    size={10}
                    color={C.dim}
                    style={{ marginTop: 12, letterSpacing: 2 }}
                  >
                    UNTIL THE POT PAYS OUT
                  </Mono>
                </View>
              )}
            </>
          )}
        </View>

        {/* Who is standing. The crown reads differently when it is yours.
            An empty floor has no king to name — the stage above says it once,
            and once is enough. */}
        {!emptyTable && (
          <Card
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              borderRadius: 20,
              paddingVertical: 15,
              paddingHorizontal: 16,
              backgroundColor: C.raised,
              borderColor: iAmKing ? "rgba(124,231,176,0.28)" : C.hairline,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: iAmKing ? C.upBg : C.inset,
                borderWidth: 1,
                borderColor: iAmKing ? "rgba(124,231,176,0.32)" : C.hairline,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 13,
                  letterSpacing: 0.5,
                  color: iAmKing ? C.up : C.silver,
                }}
              >
                {iAmKing ? "YOU" : kingInitials}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Body size={14} semibold color={iAmKing ? C.up : C.text}>
                {iAmKing
                  ? "You hold the crown"
                  : kingLabel
                    ? `${kingLabel} holds the crown`
                    : "No king yet"}
              </Body>
              <Body size={11} color={C.dim} style={{ marginTop: 3 }}>
                {iAmKing ? "Outlast the clock and the pot is yours" : kingSub}
              </Body>
            </View>
          </Card>
        )}

        {/* Money already won is money you hold — it wears the up tone, never
            the pot's chrome. */}
        {showClaim && (
          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(124,231,176,0.26)",
              backgroundColor: C.upBg,
              paddingVertical: 15,
              paddingHorizontal: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Mono size={9.5} color={C.up} style={{ letterSpacing: 1.8, opacity: 0.75 }}>
                YOUR WINNINGS
              </Mono>
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 20,
                  color: C.up,
                  marginTop: 5,
                }}
              >
                {claimAmount}
              </Text>
              <Body size={11} color={C.dim} style={{ marginTop: 4 }}>
                A payout that couldn&apos;t reach you. Claim to collect it.
              </Body>
            </View>
            <PressableScale onPress={handleClaim} scale={0.96}>
              <View
                accessibilityRole="button"
                accessibilityLabel="Claim winnings"
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(124,231,176,0.45)",
                  backgroundColor: "rgba(124,231,176,0.12)",
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  opacity: claiming ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: F.monoSemibold,
                    fontSize: 11.5,
                    letterSpacing: 1.4,
                    color: C.up,
                  }}
                >
                  {claiming ? "CLAIMING…" : "CLAIM"}
                </Text>
              </View>
            </PressableScale>
          </View>
        )}

        <View style={{ marginTop: 26 }}>
          <Body
            size={11.5}
            color={C.dim}
            style={{ textAlign: "center", lineHeight: 18, marginBottom: 14 }}
          >
            {live && featured
              ? `Wager ${minWagerLabel} to take the crown and reset the clock.\nOutlast everyone and half the pot is yours.`
              : live
                ? `A $${PLAY_TARGET_USD} stake opens the table. The starter keeps\n10% of the pot, however it ends.`
                : `Pay the $${PLAY_TARGET_USD} entry to take the crown and reset the clock.\nOutlast everyone and half the pot is yours.`}
          </Body>
          <View style={{ opacity: busy ? 0.7 : 1 }}>
            <PrimaryButton
              label={primaryLabel}
              onPress={primaryAction}
              height={56}
              radius={18}
              uppercase={false}
              color={C.brand}
            />
          </View>
          {live && featured && (
            <View style={{ marginTop: 12 }}>
              <GhostButton
                label={`Open your own table · $${PLAY_TARGET_USD}`}
                onPress={handleStart}
              />
            </View>
          )}
          {actionError && (
            <Body
              size={12}
              color={C.down}
              style={{ marginTop: 12, textAlign: "center", lineHeight: 17 }}
            >
              {actionError}
            </Body>
          )}
          <Mono
            size={9.5}
            color={C.dim}
            style={{ marginTop: 14, textAlign: "center", letterSpacing: 1.6 }}
          >
            {live && featured && minWagerEth
              ? `≈ ${minWagerEth.toUpperCase()} · SIGNED WITH FACE ID`
              : "ON-CHAIN · SIGNED WITH FACE ID"}
          </Mono>
        </View>

        {/* The room's other tables: pot, min, clock — a card in mono. */}
        {live && others.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <Label style={{ letterSpacing: 2.4 }}>OTHER TABLES</Label>
              <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
              <Mono size={10} color={C.dim} style={{ letterSpacing: 1.4 }}>
                {String(others.length).padStart(2, "0")}
              </Mono>
            </View>
            <Card
              style={{
                borderRadius: 20,
                paddingVertical: 2,
                paddingHorizontal: 16,
                backgroundColor: C.raised,
                borderColor: C.hairline,
              }}
            >
              {others.map((g, i) => {
                const secs = Math.max(0, g.endTime - now / 1000);
                const clockColor =
                  secs <= 10 ? C.down : secs <= 60 ? C.amber : C.silver;
                return (
                  <PressableScale
                    key={g.gameId}
                    onPress={() => selectGame(g.gameId)}
                    scale={0.99}
                    accessibilityLabel={`Game ${g.gameId}, pot ${g.pot.formattedUsd}`}
                    style={{
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: C.hairline,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        paddingVertical: 14,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Label style={{ fontSize: 9, letterSpacing: 1.6 }}>POT</Label>
                        <Text
                          style={{
                            fontFamily: F.monoSemibold,
                            fontSize: 17,
                            color: C.text,
                            marginTop: 3,
                          }}
                        >
                          {g.pot.formattedUsd}
                        </Text>
                        <Body size={11} color={C.dim} style={{ marginTop: 3 }}>
                          {`Min ${g.minWager.formattedUsd} · king ${truncateAddress(g.king)}`}
                        </Body>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text
                          style={{
                            fontFamily: F.monoSemibold,
                            fontSize: 15,
                            letterSpacing: 1,
                            color: clockColor,
                          }}
                        >
                          {formatClock(secs)}
                        </Text>
                        <Mono
                          size={9.5}
                          color={C.dim}
                          style={{ marginTop: 4, letterSpacing: 1.2 }}
                        >
                          {`#${g.gameId}`}
                        </Mono>
                      </View>
                    </View>
                  </PressableScale>
                );
              })}
            </Card>
          </View>
        )}

        <View style={{ marginTop: 26, alignItems: "center", gap: 8 }}>
          <View style={{ width: 32, height: 1, backgroundColor: C.hairline }} />
          {live && lastWinner && (
            <Mono
              size={9.5}
              color={C.dim}
              style={{ textAlign: "center", letterSpacing: 1.5, marginTop: 4 }}
            >
              {`LAST POT ${formatUsd(lastWinner.pot.usdValue)} · WON BY ${truncateAddress(lastWinner.winner).toUpperCase()} · ${timeAgo(lastWinner.settledAt).toUpperCase()}`}
            </Mono>
          )}
          <Body size={11} color={C.dim} style={{ textAlign: "center", marginTop: 4 }}>
            Many pots, many clocks — Paradigm
          </Body>
        </View>
      </Screen>
      <RoundOverlay myAddress={myAddress} />
    </View>
  );
}
