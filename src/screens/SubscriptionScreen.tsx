import { Image } from "expo-image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KashPlusLoader, KashPlusMark } from "@/components/KashPlusMark";
import {
  Body,
  GhostButton,
  Label,
  MetalButton,
  Mono,
  PulseDot,
  QuietButton,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { decimalsFor, formatMoney, toBigInt } from "@/lib/gateway/money";
import * as subs from "@/lib/gateway/subscription";
import { formatCountdown, toDate } from "@/lib/gateway/time";
import {
  SessionExpiredError,
  isEntitled,
  type Money,
  type PrimalAppState,
  type Subscription,
} from "@/lib/gateway/types";
import { C, withAlpha } from "@/theme/tokens";

/**
 * The paywall — and, for someone who already pays, the membership page.
 *
 * It wears exactly two faces, and which one is decided by the app state the
 * GATEWAY handed us, never by anything settled here:
 *
 * - Entitled → what they hold, when the period ends, and how to stop it. No
 *   price, no carousel, no CTA. Selling a subscription to the person already
 *   holding it is the single worst thing this screen could do.
 * - Not entitled → the pitch, the price, and one primary action.
 *
 * The second rule is the one the integration doc is explicit about: this screen
 * NEVER creates a checkout. It probes for one that already exists (`resumeCheckout`
 * creates nothing) and hands off through `onCheckout`. A member with a payment
 * already in flight is offered that payment back, not a second one — a second
 * deposit address is a second thousand dollars.
 */

/* ------------------------------------------------------------------ pitch */

/**
 * The pitch — three lines of plain English, and DATA so the panel renders
 * exactly what is on this list.
 *
 * It was a carousel of artwork cards until the reference replaced it with a
 * bulleted list on a white panel. A benefit is a sentence here, not a picture:
 * nothing needs art on disk before it can be sold, and the list cannot fall
 * below the fold the way a 330pt shelf could.
 */
const BENEFITS: readonly string[] = [
  "Access to copy top traders",
  "Seamless international payments",
  "Auto Earn (Kash Engine)",
];

const RAYS = require("@/assets/images/star_behind.png");
const PHONE = require("@/assets/images/phone_mockup.png");

/** The ray artwork's own ratio — drawn tall, bleeding off the bottom. */
const RAYS_ASPECT = 660 / 1395;
/**
 * Where the rays converge, as a fraction of the artwork's height. The burst is
 * drawn off-centre in its own file, so anchoring the layout to the file's top
 * would put the light source wherever the export happened to leave it.
 */
const RAYS_EYE = 0.34;
/** Oversized so every ray leaves through an edge instead of ending in a cut. */
const RAYS_OVERSCAN = 1.35;
/**
 * The lockup's row height — a 26pt mark beside 27pt display type.
 *
 * A constant rather than a measurement because it is what the burst is aimed
 * at: WelcomeAboardScreen anchors its eye to a fraction of the screen, which
 * works when the light comes out of an object floating mid-page, but here it
 * comes out of the WORDMARK. Aimed at a fraction, the eye drifts away from the
 * mark on every handset whose insets differ from the one it was tuned on.
 */
const LOCKUP_H = 34;

/** The handset render's own ratio (1312x2656) — width drives, height follows. */
const PHONE_ASPECT = 1312 / 2656;
/**
 * How much of the width the handset takes, capped so it stays an object rather
 * than a backdrop. At this fraction its height always exceeds the room above
 * the panel, which is what guarantees the panel overlaps it — the composition
 * is a card sitting ON the phone, and a gap between them reads as a mistake.
 */
const PHONE_WIDTH = 0.82;
const PHONE_MAX_W = 340;

/** Page gutter. Matches SignInScreen, because the lockup has to sit identically. */
const GUTTER = 26;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Deliberately not `toLocaleDateString` — Intl availability varies by engine
 *  and build, and a renewal date that renders as "Invalid Date" is worse than
 *  a plain one. */
function formatDay(value: unknown): string | null {
  const date = toDate(value as never);
  if (!date) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * The price, set the way the design sets it: `$1,000`, not `$1,000.00`.
 *
 * The cents are dropped only when there genuinely are none. A plan that ever
 * bills $999.50 prints in full — rounding a price down on the screen that sells
 * it is the kind of "tidy" that becomes a complaint.
 */
function priceText(m: Money): string {
  const decimals = decimalsFor(m.currency);
  if (decimals !== null && decimals > 0) {
    try {
      if (toBigInt(m.amountMinor) % 10n ** BigInt(decimals) === 0n) {
        return formatMoney(m, { fractionDigits: 0 });
      }
    } catch {
      // Not an integer minor-unit string. Fall through to the safe formatter,
      // which labels the raw value rather than inventing a figure.
    }
  }
  return formatMoney(m);
}

/* -------------------------------------------------------------- fragments */

/** The lockup. Same mark, size, face and tracking as SignInScreen — one brand
 *  signature across the auth-scale surfaces, not two that nearly match. */
function Lockup() {
  return (
    <View className="flex-row items-center gap-[10px]">
      <KashPlusMark height={26} color={C.text} />
      <Text className="font-display text-[27px] tracking-[-0.4px] text-text">
        KashPlus
      </Text>
    </View>
  );
}

/**
 * The pitch, set on white.
 *
 * The reference lifts the offer off the dark composition and onto a bright card
 * that overlaps the handset — so this is the one surface in the app whose ink is
 * measured against ITS ground rather than the canvas, which is what the `panel`
 * tokens exist for. Using `text-text` here would put near-white type on white.
 *
 * It renders the price the caller already formatted rather than the `Money`, so
 * there is exactly one place in this file that decides how a price is set.
 */
function Pitch({ price, period }: { price: string; period: string }) {
  return (
    <View className="bg-panel rounded-[28px] px-[24px] pt-[26px] pb-[24px]">
      <Text className="font-display-bold text-[24px] leading-[30px] tracking-[-0.5px] text-panel-ink">
        Get exclusive benefits with KashPlus subscription
      </Text>

      <View className="mt-[22px] gap-[11px]">
        {BENEFITS.map((benefit) => (
          <View key={benefit} className="flex-row items-start gap-[11px]">
            {/* Optically centred on the first line rather than top-aligned:
                a 5pt dot on the cap line of 21pt leading sits at 8. */}
            <View className="w-[5px] h-[5px] rounded-[3px] bg-panel-ink mt-[8px]" />
            <Text className="flex-1 font-body-medium text-[14.5px] leading-[21px] text-panel-ink">
              {benefit}
            </Text>
          </View>
        ))}
      </View>

      {/* The price, inset into its own well so the figure reads as the terms
          rather than as a fourth benefit. */}
      <View className="bg-panel-inset rounded-[16px] px-[16px] py-[14px] mt-[22px]">
        <Text className="font-body text-[14.5px] leading-[22px] text-panel-sub">
          {"Get access to these and more in the KashPlus ecosystem for "}
          {/* `Mono` for the tabular numerals, and inked to the panel's own dark
              rung — the figure is the one word in this sentence being sold. */}
          <Mono className="text-[14.5px] text-panel-ink font-mono-semibold">
            {price}
          </Mono>
          {` per ${period}.`}
        </Text>
      </View>
    </View>
  );
}

/**
 * One line of state above the pitch — a payment in flight, a lapsed period, an
 * entitlement still propagating.
 *
 * Deliberately a strip and not a card: the design's headline is the subject of
 * this screen, and a panel above it would demote the thing the user came to
 * read. Nothing renders at all when there is nothing true to say.
 */
function StatusStrip({
  tone,
  live = true,
  children,
  onPress,
}: {
  tone: "brand" | "amber" | "dim";
  /** Pulse the dot. Only for something actually in motion — a lapsed period is
   *  a settled fact, and animating it says the app is still working on it. */
  live?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const ink = tone === "brand" ? C.brand : tone === "amber" ? C.amber : C.sub;
  const body = (
    <View className="flex-row items-center gap-[9px] bg-card border border-rule rounded-[14px] py-[11px] px-[13px]">
      {live ? (
        <PulseDot color={ink} />
      ) : (
        <View
          className="w-[6px] h-[6px] rounded-[3px]"
          style={{ backgroundColor: ink }}
        />
      )}
      <Body className="text-[12.5px] text-silver flex-1 leading-[18px]">
        {children}
      </Body>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  );
}

function Notice({
  notice,
  onDismiss,
}: {
  notice: subs.FailureNotice;
  onDismiss: () => void;
}) {
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss"
      className="border rounded-[16px] p-[14px]"
      style={{
        backgroundColor: withAlpha(C.down, 0.1),
        borderColor: withAlpha(C.down, 0.35),
      }}
    >
      <Body className="text-[12.5px] text-down font-body-semibold">
        {notice.title}
      </Body>
      <Body className="text-[12px] text-silver mt-[4px] leading-[17.5px]">
        {notice.detail}
      </Body>
      {notice.correlationId ? (
        <Mono className="text-[9.5px] text-dim mt-[8px] tracking-[1px]">
          REF {notice.correlationId}
        </Mono>
      ) : null}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- screen */

export interface SubscriptionScreenProps {
  /** Backend-derived. Which face this screen wears, and nothing local. */
  state: PrimalAppState;
  /**
   * Hand off to the crypto checkout.
   *
   * `subscriptionId` is the checkout this device already has open, or `null` for
   * a first purchase. This screen never creates one: the checkout surface owns
   * the idempotency key, the origin asset and the refund address, and two places
   * calling `startCheckout` is exactly how one membership becomes two.
   */
  onCheckout: (subscriptionId: string | null) => void;
  onBack?: () => void;
  /**
   * What the back control says. Defaults to "Close", which is right when this
   * screen is a detour from inside the app — but when it is the entry gate the
   * only way past it is out of the account, and the control has to say so.
   */
  backLabel?: string;
  /** The session died mid-flight; the route sends them to sign in. */
  onSignIn?: () => void;
  /** Re-probe entitlement after a cancellation (or a sync) changes it. */
  onEntitlementChanged?: () => void | Promise<void>;
}

export default function SubscriptionScreen({
  state,
  onCheckout,
  onBack,
  backLabel = "Close",
  onSignIn,
  onEntitlementChanged,
}: SubscriptionScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<subs.FailureNotice | null>(null);
  const [membership, setMembership] = useState<Subscription | null>(null);
  const [pending, setPending] = useState<subs.Checkout | null>(null);
  const [confirmImmediate, setConfirmImmediate] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const entitled = isEntitled(state);

  const handleSessionLoss = useCallback(
    (error: unknown): boolean => {
      if (!SessionExpiredError.is(error)) return false;
      onSignIn?.();
      return true;
    },
    [onSignIn],
  );

  // Pick up whatever this device already has, WITHOUT creating anything. A
  // half-finished payment must reappear here, or the user starts a second one.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const existing = await subs.resumeCheckout({
          signal: controller.signal,
        });
        if (!alive.current) return;
        if (existing) {
          setMembership(existing.subscription);
          const status = existing.payment?.status ?? "UNKNOWN";
          setPending(subs.isPayablePayment(status) ? existing : null);
        }
      } catch (error) {
        // A failed probe is not an error the user has to read — the screen still
        // works, it just cannot name their renewal date. Only a dead session is
        // worth acting on, and that is a routing decision.
        if (alive.current) handleSessionLoss(error);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [handleSessionLoss]);

  // One clock, running only while a payment window is actually counting down.
  useEffect(() => {
    if (!pending?.payment?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [pending]);

  // The page arrives composed rather than assembled: one driver, sliced per
  // block, so the lockup settles before the headline and the headline before
  // the shelf. Same curve and stagger as SignInScreen.
  const intro = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (loading) return;
    Animated.timing(intro, {
      toValue: 1,
      duration: 760,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [intro, loading]);

  const step = useCallback(
    (i: number) => {
      const start = i * 0.12;
      const range = [start, Math.min(start + 0.5, 1)];
      return {
        opacity: intro.interpolate({
          inputRange: range,
          outputRange: [0, 1],
          extrapolate: "clamp" as const,
        }),
        transform: [
          {
            translateY: intro.interpolate({
              inputRange: range,
              outputRange: [16, 0],
              extrapolate: "clamp" as const,
            }),
          },
        ],
      };
    },
    [intro],
  );

  const cancel = useCallback(
    async (atPeriodEnd: boolean) => {
      if (cancelling || !membership) return;
      setCancelling(true);
      setNotice(null);
      try {
        const updated = await subs.cancelSubscription(
          membership.id,
          atPeriodEnd,
        );
        if (!alive.current) return;
        if (updated) setMembership(updated);
        setConfirmImmediate(false);
        // The gateway decides what this changed; ask it rather than assume.
        await onEntitlementChanged?.();
      } catch (error) {
        if (!alive.current) return;
        if (handleSessionLoss(error)) return;
        setNotice(subs.describeFailure(error));
      } finally {
        if (alive.current) setCancelling(false);
      }
    },
    [cancelling, membership, onEntitlementChanged, handleSessionLoss],
  );

  const recheck = useCallback(async () => {
    if (rechecking) return;
    setRechecking(true);
    try {
      await onEntitlementChanged?.();
    } finally {
      if (alive.current) setRechecking(false);
    }
  }, [rechecking, onEntitlementChanged]);

  const price = priceText(subs.priceOf(membership));

  /**
   * The burst, and the handset it lights.
   *
   * Both are laid out in POINTS off the width rather than in percentages: a
   * percentage `top` resolves against the parent's height while the artwork is
   * sized off its own aspect, so the composition would drift with the shape of
   * the handset it is running on.
   */
  const raysW = width * RAYS_OVERSCAN;
  const raysH = raysW / RAYS_ASPECT;
  const raysBox = {
    position: "absolute" as const,
    width: raysW,
    height: raysH,
    left: (width - raysW) / 2,
    // The eye lands on the middle of the lockup — same arithmetic the padded
    // column below uses to place it, so the two cannot drift apart.
    top: insets.top + 14 + LOCKUP_H / 2 - raysH * RAYS_EYE,
  };

  const phoneW = Math.min(PHONE_MAX_W, Math.round(width * PHONE_WIDTH));
  const phoneH = Math.round(phoneW / PHONE_ASPECT);

  const frame = useMemo(
    () => ({
      flex: 1,
      backgroundColor: C.canvas,
      paddingTop: insets.top + 14,
      paddingBottom: Math.max(insets.bottom, 24) + 6,
    }),
    [insets.top, insets.bottom],
  );

  /* ------------------------------------------------------------- loading */

  // The same frame, so nothing jumps when the probe answers: the lockup is
  // already in its final place and only the body below it fills in.
  if (loading) {
    return (
      <View style={frame}>
        <View style={{ paddingHorizontal: GUTTER }}>
          <Lockup />
        </View>
        <View className="flex-1 items-center justify-center">
          <KashPlusLoader height={38} color={C.brand} />
          <Body className="text-[12.5px] text-dim mt-[18px]">
            Checking your membership
          </Body>
        </View>
      </View>
    );
  }

  /* ------------------------------------------------------------- entitled */

  if (entitled) {
    const renews = formatDay(membership?.currentPeriodEnd);
    const ending =
      state === "cancel_at_period_end" ||
      membership?.status === "CANCEL_AT_PERIOD_END" ||
      membership?.cancelAtPeriodEnd === true;

    return (
      <View style={frame}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingBottom: 28,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row items-center">
            <Lockup />
            <View className="flex-1" />
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={12}
                accessibilityRole="button"
              >
                <Body className="text-[13px] text-sub">{backLabel}</Body>
              </Pressable>
            ) : null}
          </View>

          <View className="flex-row items-center gap-[8px] mt-[34px]">
            <View
              className={cn(
                "w-[7px] h-[7px] rounded-[4px]",
                ending ? "bg-amber" : "bg-up",
              )}
            />
            <Mono
              size={10}
              className={cn(
                "tracking-[1.4px]",
                ending ? "text-amber" : "text-up",
              )}
            >
              {subs
                .describeSubscriptionStatus(membership?.status ?? "ACTIVE")
                .toUpperCase()}
            </Mono>
          </View>

          <Text className="font-display-bold text-[34px] leading-[41px] tracking-[-0.8px] text-text mt-[12px]">
            {ending ? "Your membership is ending" : "You have KashPlus"}
          </Text>

          {/* Composed rather than interpolated, because the price is money and
              money is set with `Mono`. Plain `Mono` here, not the semibold cut:
              on this face the figure is a fact in a sentence, not the offer, so
              it gets the tabular numerals without the paywall's emphasis. */}
          <Body className="text-[15px] text-sub mt-[12px] leading-[23px]">
            {renews ? (
              ending ? (
                `Everything keeps working until ${renews}. Nothing will be charged after that.`
              ) : (
                <>
                  {`Renews ${renews} at `}
                  <Mono className="text-[15px] text-sub">{price}</Mono>
                  {` per ${subs.MEMBERSHIP_PERIOD}.`}
                </>
              )
            ) : (
              <>
                {"Billed "}
                <Mono className="text-[15px] text-sub">{price}</Mono>
                {` per ${subs.MEMBERSHIP_PERIOD}.`}
              </>
            )}
          </Body>

          {membership ? (
            ending ? null : (
              <View className="mt-[34px]">
                {confirmImmediate ? (
                  <View
                    className="border rounded-[20px] p-[18px]"
                    style={{
                      backgroundColor: withAlpha(C.down, 0.08),
                      borderColor: withAlpha(C.down, 0.3),
                    }}
                  >
                    <Body className="text-[14px] text-down font-body-semibold">
                      End access now?
                    </Body>
                    <Body className="text-[12.5px] text-silver mt-[8px] leading-[19px]">
                      Your account, transfers and bill payments stop the moment
                      this goes through — not at the end of the month you have
                      paid for. There is no refund for the remaining days.
                    </Body>
                    <View className="flex-row gap-[10px] mt-[18px]">
                      <GhostButton
                        label="Keep membership"
                        onPress={() => setConfirmImmediate(false)}
                        style={{ flex: 1 }}
                        disabled={cancelling}
                      />
                      <GhostButton
                        label="End access now"
                        onPress={() => void cancel(false)}
                        loading={cancelling}
                        style={{
                          flex: 1,
                          borderColor: withAlpha(C.down, 0.45),
                        }}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <Label>Ending it</Label>
                    <Body className="text-[13px] text-sub mt-[10px] leading-[20px]">
                      Stopping at the end of the period keeps everything working
                      until{renews ? ` ${renews}` : " it runs out"}. Ending now
                      is immediate.
                    </Body>
                    <View className="mt-[18px] gap-[10px]">
                      <QuietButton
                        label="Stop renewing"
                        onPress={() => void cancel(true)}
                        loading={cancelling}
                      />
                      <Pressable
                        onPress={() => setConfirmImmediate(true)}
                        accessibilityRole="button"
                        className="items-center py-[12px]"
                      >
                        <Body className="text-[12.5px] text-dim">
                          End access immediately
                        </Body>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )
          ) : (
            <Body className="text-[12.5px] text-dim mt-[26px] leading-[19px]">
              Renewal details are not available on this device. Sign in on the
              device that started the membership to manage it.
            </Body>
          )}

          {notice ? (
            <View className="mt-[20px]">
              <Notice notice={notice} onDismiss={() => setNotice(null)} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  /* -------------------------------------------------------------- paywall */

  const pendingExpiry = pending?.payment?.expiresAt;
  // `formatCountdown` reads the clock itself, so `now` is the dependency that
  // makes it recompute — it is the tick, not an input.
  const pendingCountdown = pendingExpiry
    ? formatCountdown(pendingExpiry)
    : null;
  void now;

  const syncing = state === "entitlement_syncing";
  // `payment_pending` is the gateway's word for it; `pending` is this device's
  // evidence of the same thing. Either is reason enough to offer the payment
  // back rather than sell a second one.
  const resumable = pending !== null || state === "payment_pending";

  /**
   * The reference's composition, top to bottom: the burst, the lockup it comes
   * out of, the handset, and the white panel sitting ON the handset with the
   * CTA under it.
   *
   * NOT a ScrollView, unlike the shelf version this replaced. Every block here
   * is fixed or flexes, so the page is exactly one screen tall on any handset —
   * and a paywall whose CTA can be scrolled off is a paywall with a way to miss
   * the button.
   */
  return (
    <View className="flex-1 bg-canvas">
      {/* Outside the padded column on purpose: the burst bleeds to the edges,
          and inside it the insets would inset the light source too. */}
      <View pointerEvents="none" style={raysBox}>
        <Image
          source={RAYS}
          contentFit="fill"
          style={{ width: raysW, height: raysH, opacity: 0.55 }}
        />
      </View>

      <View
        className="flex-1"
        style={{
          paddingTop: insets.top + 14,
          paddingBottom: Math.max(insets.bottom, 24) + 6,
        }}
      >
        {/* The lockup is CENTRED, which is why the exit is absolute rather than
            a row sibling: pushed apart with a spacer, the wordmark would sit
            wherever the word "Sign out" left room for it, and move when the
            label changes. */}
        <Animated.View
          className="flex-row items-center justify-center"
          style={[{ paddingHorizontal: GUTTER }, step(0)]}
        >
          <Lockup />
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              className="absolute"
              style={{ right: GUTTER }}
            >
              <Body className="text-[13px] text-sub">{backLabel}</Body>
            </Pressable>
          ) : null}
        </Animated.View>

        {syncing || resumable || state === "expired" ? (
          <Animated.View
            className="mt-[18px]"
            style={[{ paddingHorizontal: GUTTER }, step(1)]}
          >
            {syncing ? (
              <StatusStrip tone="amber">
                Your payment is confirmed. Primal is still enabling the account
                — this usually takes under a minute.
              </StatusStrip>
            ) : resumable ? (
              <StatusStrip
                tone="brand"
                onPress={() => onCheckout(pending?.subscription.id ?? null)}
              >
                You have a payment open on this device
                {/* The countdown re-renders every second and changes digits as
                    it falls — a bare `Text` lets the whole sentence twitch on
                    each tick. `Mono` holds the figure's width. */}
                {pendingCountdown ? (
                  <>
                    {" — it closes in "}
                    <Mono className="text-[12.5px] text-silver">
                      {pendingCountdown}
                    </Mono>
                  </>
                ) : null}
                .
              </StatusStrip>
            ) : (
              <StatusStrip tone="dim" live={false}>
                Your membership has ended. Starting it again brings the account,
                the rails and the crypto side straight back.
              </StatusStrip>
            )}
          </Animated.View>
        ) : null}

        {/* The stage. The handset is pinned to the TOP of whatever room is left
            and the panel to the bottom of it, so the two meet in the middle
            wherever that lands — the overlap is the composition, and clipping
            is what keeps the render off the CTA on a short device.

            The handset is deliberately narrower than the panel: they overlap
            across its full width, so no part of the cropped render can peek out
            beside the panel's rounded corners. */}
        <View className="flex-1 mt-[16px] overflow-hidden">
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                left: (width - phoneW) / 2,
                width: phoneW,
                height: phoneH,
              },
              step(2),
            ]}
          >
            <Image
              source={PHONE}
              contentFit="contain"
              contentPosition="top center"
              style={{ width: phoneW, height: phoneH }}
              accessibilityLabel="The KashPlus home screen"
            />
          </Animated.View>

          <Animated.View
            className="flex-1 justify-end"
            style={[{ paddingHorizontal: GUTTER }, step(3)]}
          >
            <Pitch price={price} period={subs.MEMBERSHIP_PERIOD} />
          </Animated.View>
        </View>

        {/* No `Notice` here on purpose: nothing this face can do produces a
            gateway failure. It creates no checkout and cancels nothing — the two
            calls that can fail both live on the entitled face, and a slot for an
            error that cannot happen is a slot that eventually shows the wrong
            one. */}
        <Animated.View
          className="mt-[20px]"
          style={[{ paddingHorizontal: GUTTER }, step(4)]}
        >
          {syncing ? (
            // Nothing to buy: the money has landed and the account is being
            // switched on. The only honest action is to ask again.
            <QuietButton
              label="Check again"
              onPress={() => void recheck()}
              loading={rechecking}
            />
          ) : (
            // The reference's label, and the one press that opens the checkout
            // sheet over this screen — `onCheckout` is the hand-off, and this
            // screen still creates nothing itself.
            <MetalButton
              label={resumable ? "Resume your payment" : "Get Access"}
              onPress={() => onCheckout(pending?.subscription.id ?? null)}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
}
