import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { C } from "@/theme/tokens";
import { cn } from "@/lib/cn";

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

interface Benefit {
  key: string;
  title: string;
  art: ImageSource;
}

/**
 * The carousel's contents — DATA, so the shelf renders exactly as many cards as
 * there is artwork for.
 *
 * A card with no image is a black rectangle with a caption, which on a paywall
 * reads as a broken app rather than as a benefit. So an entry only lands here
 * once its art is on disk beside these two; the dots count themselves off this
 * list, and nothing else needs touching.
 */
const BENEFITS: readonly Benefit[] = [
  {
    key: "top-traders",
    title: "Access to top traders",
    art: require("@/assets/images/top_traders.png") as ImageSource,
  },
  {
    key: "kash-engine",
    title: "Kash Engine",
    art: require("@/assets/images/kash_engine.png") as ImageSource,
  },
];

/**
 * The design's card is 300×330 and the artwork was exported to match (293×311,
 * 293×327). On a phone that is ~76% of the viewport, which is what puts the next
 * card's edge on screen — the peek IS the affordance that says "these scroll".
 * Capped rather than fixed so a narrow device shrinks the card instead of
 * pushing the peek off the right edge entirely.
 */
const CARD_MAX_W = 300;
const CARD_RATIO = 330 / 300;
const CARD_GAP = 14;
const CARD_RADIUS = 18;
/** Below this the artwork stops being a card and starts being a thumbnail. */
const CARD_MIN_H = 236;
/** Dots plus their breathing room — reserved so they never fall off the page. */
const DOTS_BLOCK = 34;

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

function BenefitCard({
  benefit,
  width,
  height,
}: {
  benefit: Benefit;
  width: number;
  height: number;
}) {
  return (
    <View
      className="overflow-hidden bg-sheet"
      style={{
        width,
        height,
        borderRadius: CARD_RADIUS,
      }}
      accessible
      accessibilityLabel={benefit.title}
    >
      {/* The artwork is a cut-out on transparency, so the card has to supply its
          own ground. Cast toward the brand rather than neutral: the accent
          sitting on plain charcoal goes muddy, on a green-biased black it keeps
          its lit edge. Re-cast off the gold 2026-08-22 with the brand; kept a
          hair darker than the old #3A3222 so the text tiers measured against
          this slab in `C` only gain contrast. */}
      <LinearGradient
        colors={["#26331C", "#121410"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={benefit.art}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
      />
      {/* Scrim, not a caption bar. The title sits ON the image, and the only
          thing between them is enough falloff to keep it readable. */}
      <LinearGradient
        colors={["rgba(10,10,10,0)", "rgba(10,10,10,0.88)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: Math.round(height * 0.46),
        }}
      />
      <Body
        className="text-[15px] font-body-semibold absolute left-[16px] right-[16px] bottom-[15px]"

        numberOfLines={2}
      >
        {benefit.title}
      </Body>
    </View>
  );
}

/** Page position. The active dot elongates rather than brightening, so the
 *  shelf's position is legible at a glance instead of by comparing two greys. */
function Dots({ count, active }: { count: number; active: number }) {
  if (count < 2) return null;
  return (
    <View className="flex-row items-center justify-center gap-[6px] mt-[18px]">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className={cn(
            "h-[6px] rounded-[3px]",
            i === active ? "bg-brand" : "bg-border-strong",
          )}
          style={{
            width: i === active ? 20 : 6,
          }}
        />
      ))}
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
        backgroundColor: "rgba(246,165,165,0.1)",
        borderColor: "rgba(246,165,165,0.35)",
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
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // Measured, because the headline is the one block whose height cannot be
  // predicted — it wraps to three lines or four depending on the device, and
  // the shelf has to live in whatever is left.
  const [viewportH, setViewportH] = useState(0);
  const [shelfY, setShelfY] = useState(0);

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

  // 76% of the viewport, capped at the design's 300. The cap is what holds the
  // artwork at its exported size on a normal phone; the fraction is what keeps
  // the next card peeking on a narrow one instead of pushing it off the edge.
  const baseW = Math.min(CARD_MAX_W, Math.round(width * 0.76));
  // Then fit that to the room the headline actually left. At the design size the
  // shelf's foot lands a few points past the fold on a 6.1" phone, which puts
  // the dots — the only thing saying how many cards there are — out of sight.
  // Shrinking the card by those few points is a far smaller lie than hiding the
  // pagination, and the ratio is held either way so the artwork never distorts.
  const room =
    viewportH > 0 && shelfY > 0 ? viewportH - shelfY - DOTS_BLOCK : 0;
  const cardH =
    room > 0
      ? Math.max(CARD_MIN_H, Math.min(Math.round(baseW * CARD_RATIO), room))
      : Math.round(baseW * CARD_RATIO);
  const cardW = Math.min(baseW, Math.round(cardH / CARD_RATIO));
  const stride = cardW + CARD_GAP;

  /**
   * The trailing inset that makes the pagination TRUE.
   *
   * Snap points sit at `k * stride`, and card `k` only lands on the left gutter
   * at that offset. With a symmetric gutter the content simply ends too soon:
   * the shelf can be dragged no further than `content - viewport`, which for two
   * 300pt cards on a 393pt phone is ~40pt short of the second snap point, and
   * for three is a whole card short of the third. The dots then advertise a
   * position the shelf physically cannot take — the last one worst of all, since
   * it can never be the card resting at the gutter.
   *
   * Padding the tail by exactly the empty space to the right of a gutter-aligned
   * card makes the scrollable range `(n - 1) * stride` for ANY n: every snap
   * point is reachable, the last card comes fully to the gutter, and the dot for
   * it lights up because the content got there rather than because the offset
   * happened to round up. The `GUTTER` floor is a safety net for a viewport too
   * narrow to leave any tail; the card cap (76% of width) keeps it unused.
   */
  const shelfTail = Math.max(GUTTER, width - GUTTER - cardW);

  const onShelfScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (stride <= 0) return;
      const raw = Math.round(event.nativeEvent.contentOffset.x / stride);
      const next = Math.max(0, Math.min(BENEFITS.length - 1, raw));
      setPage((current) => (current === next ? current : next));
    },
    [stride],
  );

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
                      backgroundColor: "rgba(246,165,165,0.08)",
                      borderColor: "rgba(246,165,165,0.3)",
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
                          borderColor: "rgba(246,165,165,0.45)",
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

  return (
    <View style={frame}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => setViewportH(event.nativeEvent.layout.height)}
      >
        <Animated.View
          className="flex-row items-center"
          style={[
            {
              paddingHorizontal: GUTTER,
            },
            step(0),
          ]}
        >
          <Lockup />
          <View className="flex-1" />
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button">
              <Body className="text-[13px] text-sub">{backLabel}</Body>
            </Pressable>
          ) : null}
        </Animated.View>

        {syncing || resumable || state === "expired" ? (
          <Animated.View
            className="mt-[22px]"
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

        <Animated.View
          className="mt-[26px]"
          style={[{ paddingHorizontal: GUTTER }, step(2)]}
        >
          <Text
            className="font-display-bold tracking-[-1px] text-text"
            style={{
              // The headline is the screen. It steps down on narrow devices
              // rather than wrapping to five lines and pushing the shelf under
              // the fold.
              fontSize: width < 380 ? 33 : 38,
              lineHeight: width < 380 ? 40 : 46,
            }}
          >
            Get exclusive benefits with KashPlus subscription
          </Text>

          <Body className="text-[15px] text-sub mt-[14px] leading-[23px]">
            Get exclusive benefits with KashPlus Subscription{" "}
            {/* The figure goes through `Mono` for the tabular numerals, and
                `monoSemibold` — the same cut `bodySemibold` resolves to — so it
                keeps the weight the design gives it against the sentence. */}
            <Mono className="text-[15px] text-text font-mono-semibold">
              {price}
            </Mono>{" "}
            per {subs.MEMBERSHIP_PERIOD}.
          </Body>
        </Animated.View>

        <Animated.View className="mt-[34px]" style={step(3)}>
          <Label style={{ paddingHorizontal: GUTTER }}>Premium Benefits</Label>
        </Animated.View>

        {/* Its own block, and the same slice of the stagger, so the label and the
            shelf still arrive together — split only so this wrapper's `y` is the
            shelf's own offset in the page, which is what sizes the cards. */}
        <Animated.View
          className="mt-[16px]"
          style={step(3)}
          onLayout={(event) => setShelfY(event.nativeEvent.layout.y)}
        >
          {/* Full-bleed shelf: the gutter lives in the content inset, not on the
              ScrollView, so a card can scroll past the page margin instead of
              being clipped at it. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={stride}
            snapToAlignment="start"
            onScroll={onShelfScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingLeft: GUTTER,
              paddingRight: shelfTail,
              gap: CARD_GAP,
            }}
          >
            {BENEFITS.map((benefit) => (
              <BenefitCard
                key={benefit.key}
                benefit={benefit}
                width={cardW}
                height={cardH}
              />
            ))}
          </ScrollView>

          <Dots count={BENEFITS.length} active={page} />
        </Animated.View>
      </ScrollView>

      {/* No `Notice` here on purpose: nothing this face can do produces a
          gateway failure. It creates no checkout and cancels nothing — the two
          calls that can fail both live on the entitled face, and a slot for an
          error that cannot happen is a slot that eventually shows the wrong one. */}
      <Animated.View style={[{ paddingHorizontal: GUTTER }, step(4)]}>
        {syncing ? (
          // Nothing to buy: the money has landed and the account is being
          // switched on. The only honest action is to ask again.
          <QuietButton
            label="Check again"
            onPress={() => void recheck()}
            loading={rechecking}
          />
        ) : (
          <MetalButton
            label={resumable ? "Resume your payment" : "Get it now"}
            onPress={() => onCheckout(pending?.subscription.id ?? null)}
          />
        )}
      </Animated.View>
    </View>
  );
}
