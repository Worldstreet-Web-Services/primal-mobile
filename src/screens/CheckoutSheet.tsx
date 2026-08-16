import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CopyMark, useCopy } from "@/components/CopyAction";
import { ParadigmLoader } from "@/components/ParadigmMark";
import {
  AlertIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
} from "@/components/icons";
import {
  BackChevron,
  Body,
  CircleAction,
  Display,
  Label,
  MetalButton,
  Mono,
  PILL,
  PulseDot,
  QuietButton,
} from "@/components/ui";
import { appIsActive, onForeground } from "@/lib/appActive";
import { formatMoney, toBigInt } from "@/lib/gateway/money";
import * as subs from "@/lib/gateway/subscription";
import { formatCountdown, millisUntil, toMillis } from "@/lib/gateway/time";
import {
  AbortedError,
  SessionExpiredError,
  type CryptoPayment,
  type Subscription,
} from "@/lib/gateway/types";
import { C, F } from "@/theme/tokens";

/**
 * Crypto checkout — the surface that moves USD 1,000 of someone's money.
 *
 * Everything unusual in here is unusual for one of four reasons, and they are
 * worth stating up front because each of them is a way a person loses money:
 *
 * 1. **The idempotency key is the gateway's, not ours.** This screen never
 *    mints one. `subs.startCheckout` owns that: it persists an intent before
 *    the POST, reuses it for every retry of the same intended checkout, and
 *    only lets a NEW key be minted once the previous operation has genuinely
 *    concluded. A timeout here is therefore a reason to ask again with the same
 *    key, never a reason to start over.
 * 2. **The origin route is read from a trusted table, never from the wire.**
 *    `readOriginQuote` resolves the symbol and decimals from `ORIGIN_NETWORKS`;
 *    a response field claiming to be "USDC" is not evidence of anything. If the
 *    quote does not resolve, this screen refuses to print a send instruction at
 *    all — an unknown asset on an unknown chain is money sent nowhere.
 * 3. **The address is never truncated.** Address poisoning works precisely
 *    because interfaces show `0x8335…2913`. The whole string is on screen, in
 *    groups, with an explicit review that weights the two ends.
 * 4. **A settled payment is not an entitlement.** SETTLED means the money
 *    landed. Whether the account may use the app is a separate question, asked
 *    of the gateway by `checkEntitled` and answered only by it — which is why
 *    the confirmed state says "enabling your account" and then waits, rather
 *    than unlocking anything locally.
 *
 * The amount shown is `originAmount`, which is legitimately LARGER than the
 * 1,000 USDC that must settle because the route's fees are grossed up into it.
 * Sending the settlement figure instead underpays. Nothing here "corrects" it.
 */

/* -------------------------------------------------------------- primitives */

/** Dims the paywall behind without erasing it — the sheet is a step within
 *  that decision, not a different place the user has been taken to. */
const SCRIM = "rgba(10,10,11,0.5)";
const DANGER_TINT = "rgba(246,165,165,0.10)";
const DANGER_EDGE = "rgba(246,165,165,0.32)";
const BRAND_EDGE = "rgba(227,182,47,0.42)";

/**
 * Is the origin leg provably larger than what has to settle?
 *
 * Only asked when both legs are quoted in the same unit — the configured table
 * is USDC-only today, and comparing a USDC figure against an ETH one would be
 * arithmetic on two different scales. A route we cannot compare simply says
 * nothing about the difference rather than saying something wrong about it.
 */
function isGrossedUp(
  payment: CryptoPayment | null,
  asset: subs.OriginAsset | null,
): boolean {
  if (!payment?.originAmount || !payment.requiredSettlementAmount) return false;
  if (!asset || asset.symbol !== "USDC") return false;
  try {
    return (
      toBigInt(payment.originAmount) > toBigInt(payment.requiredSettlementAmount)
    );
  } catch {
    return false;
  }
}

function Notice({
  notice,
  onDismiss,
}: {
  notice: subs.FailureNotice;
  onDismiss?: () => void;
}) {
  return (
    <Pressable
      onPress={onDismiss}
      disabled={!onDismiss}
      accessibilityRole={onDismiss ? "button" : undefined}
      accessibilityLabel={onDismiss ? "Dismiss" : undefined}
      style={{
        marginTop: 16,
        backgroundColor: DANGER_TINT,
        borderWidth: 1,
        borderColor: DANGER_EDGE,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Body size={12.5} semibold color={C.down}>
        {notice.title}
      </Body>
      <Body size={12} color={C.silver} style={{ marginTop: 4, lineHeight: 17.5 }}>
        {notice.detail}
      </Body>
      {notice.correlationId ? (
        <Mono size={9.5} color={C.dim} style={{ marginTop: 8, letterSpacing: 1 }}>
          REF {notice.correlationId}
        </Mono>
      ) : null}
    </Pressable>
  );
}

/** Label over value, the shape support reads back over the phone. */
function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <Label>{label}</Label>
      <Mono size={11} color={C.silver} style={{ marginTop: 4, lineHeight: 16 }}>
        {value}
      </Mono>
    </View>
  );
}

/** A chip that is a statement of fact when `locked`, and a control otherwise. */
function RouteChip({
  value,
  caption,
  selected,
  locked,
  open,
  onPress,
  flex,
}: {
  value: string;
  caption: string;
  selected: boolean;
  locked: boolean;
  /** Shows the disclosure glyph — only a selector that can actually open. */
  open?: boolean;
  onPress?: () => void;
  flex?: number;
}) {
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: C.raised,
        borderWidth: 1,
        borderColor: selected ? C.brand : C.border,
        borderRadius: 14,
        paddingVertical: 11,
        paddingHorizontal: 14,
      }}
    >
      <View style={{ flex: 1 }}>
        <Label style={{ fontSize: 9, letterSpacing: 1.3 }}>{caption}</Label>
        <Body size={14} semibold color={C.text} style={{ marginTop: 3 }}>
          {value}
        </Body>
      </View>
      {open === undefined ? null : (
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDownIcon size={15} color={C.silver} />
        </View>
      )}
    </View>
  );

  if (locked || !onPress) return <View style={{ flex }}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${caption}: ${value}`}
      accessibilityState={{ expanded: open }}
      style={{ flex }}
    >
      {body}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ screen */

export interface CheckoutSheetProps {
  /**
   * The subscription whose payment this is. Absent means "whatever this device
   * already has" — a deep link, or a relaunch mid-payment.
   */
  subscriptionId?: string | null;
  /** Where a failed route refunds to. The user's own wallet, never ours. */
  walletAddress: string | null;
  onBack?: () => void;
  onClose?: () => void;
  /** The session died mid-flight; the route sends them to sign in. */
  onSignIn?: () => void;
  /**
   * The GATEWAY confirmed entitlement. Not "the payment settled" — the two are
   * different events and only this one may open the app.
   */
  onEntitled: () => void;
}

type Stage = "loading" | "ready" | "enabling" | "support" | "failed";

export default function CheckoutSheet({
  subscriptionId,
  walletAddress,
  onBack,
  onClose,
  onSignIn,
  onEntitled,
}: CheckoutSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { copied, copy } = useCopy();

  const [stage, setStage] = useState<Stage>("loading");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payment, setPayment] = useState<CryptoPayment | null>(null);
  const [notice, setNotice] = useState<subs.FailureNotice | null>(null);
  const [busy, setBusy] = useState(false);

  /** The route the user has chosen for a checkout that does not exist yet. */
  const [chainId, setChainId] = useState(subs.DEFAULT_ORIGIN_CHAIN_ID);
  const [picking, setPicking] = useState(false);

  const [acknowledged, setAcknowledged] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  /** The window shut and the final poll has been spent. Manual from here. */
  const [stalled, setStalled] = useState(false);
  const [recheck, setRecheck] = useState(0);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [tick, setTick] = useState(0);

  /**
   * One id across the create and every poll of this attempt, so a user stuck in
   * the entitlement gap has something support can search on. Minted once per
   * mount — it names the watching, not the operation, and must never be
   * confused with the idempotency key that names the operation.
   */
  const [trace] = useState(() => subs.newCheckoutTrace());

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Callbacks live in a ref so the poll and sync loops below do not restart —
  // and reset their backoff counters — every time the route re-renders with a
  // fresh arrow function.
  const exits = useRef({ onSignIn, onEntitled });
  useEffect(() => {
    exits.current = { onSignIn, onEntitled };
  }, [onSignIn, onEntitled]);

  // The poll loop reads the current expiry without taking `payment` as a
  // dependency; taking it would restart the loop on every successful poll.
  const latest = useRef<CryptoPayment | null>(null);
  useEffect(() => {
    latest.current = payment;
  }, [payment]);

  const subId = subscription?.id ?? subscriptionId ?? null;
  const status = payment?.status ?? "UNKNOWN";
  const terminal = payment ? subs.isTerminalPayment(status) : false;
  const quote = useMemo(() => subs.readOriginQuote(payment), [payment]);
  const expiryMs = useMemo(() => toMillis(payment?.expiresAt ?? null), [payment]);
  const network = subs.networkFor(chainId) ?? subs.networkFor(subs.DEFAULT_ORIGIN_CHAIN_ID)!;
  const asset = network.assets[0];

  const handleSessionLoss = useCallback((error: unknown): boolean => {
    if (!SessionExpiredError.is(error)) return false;
    exits.current.onSignIn?.();
    return true;
  }, []);

  /* --------------------------------------------------------- first read */

  // Load what exists. This creates nothing: a user who killed the app mid
  // payment must land back on the same deposit address, not be sold a second
  // membership.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const checkout = subscriptionId
          ? await subs.loadCheckout(subscriptionId, { signal: controller.signal })
          : await subs.resumeCheckout({ signal: controller.signal });
        if (!alive.current) return;
        if (checkout) {
          setSubscription(checkout.subscription);
          setPayment(checkout.payment);
          const live = checkout.payment?.originChainId;
          if (typeof live === "number" && subs.networkFor(live)) setChainId(live);
        }
        setStage("ready");
      } catch (error) {
        if (!alive.current || AbortedError.is(error)) return;
        if (handleSessionLoss(error)) return;
        setNotice(subs.describeFailure(error));
        setStage("failed");
      }
    })();

    return () => controller.abort();
  }, [subscriptionId, handleSessionLoss]);

  /* ------------------------------------------------------ terminal effects */

  // The intent named an operation that has now concluded. Discarding the key
  // here is what makes the NEXT renewal a genuinely new operation with its own
  // key — and it is the only place that discard is allowed to happen.
  useEffect(() => {
    if (!terminal) return;
    void subs.concludeCheckout(status);
  }, [terminal, status]);

  // Settled: the money landed. Entitlement is a separate question and the
  // gateway is the only one who may answer it.
  useEffect(() => {
    if (stage === "ready" && status === "SETTLED") setStage("enabling");
  }, [stage, status]);

  /* ----------------------------------------------------------- poll loop */

  useEffect(() => {
    if (stage !== "ready" || !subId || terminal) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    /** Consecutive transport/503 failures. Any success resets it to 0. */
    let failures = 0;
    /** Whether this run of the loop has actually asked the gateway anything. */
    let asked = false;
    /** One request at a time. The foreground catch-up below can otherwise fire
     *  a second poll beside one already in flight, and each would schedule its
     *  own successor — a loop that quietly doubles its rate every time the app
     *  is switched away from and back. */
    let inFlight = false;

    const schedule = () => {
      if (cancelled) return;
      const expiresAt = latest.current?.expiresAt;
      const remaining = expiresAt ? millisUntil(expiresAt) : null;

      // Past the stated expiry, with a successful poll already spent on it:
      // that WAS the final check the contract asks for. Polling a window that
      // cannot move, once a second, forever, is a storm — so the loop ends here
      // and a manual re-check takes over. A final check that never landed
      // (failures > 0) is the exception; the backoff still owes us an answer.
      if (remaining === 0 && asked && failures === 0) {
        setStalled(true);
        return;
      }

      const base = subs.nextPollDelayMs({ visible: appIsActive(), failures });
      const delay = expiresAt ? subs.pollDelayBeforeExpiry(base, expiresAt) : base;
      timer = setTimeout(() => void poll(), delay);
    };

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      // Terminal, cancelled, aborted and session-loss all leave without
      // scheduling; everything else earns another turn of the loop.
      let done = true;
      try {
        const next = await subs.getPayment(subId, {
          signal: controller.signal,
          correlationId: trace,
        });
        if (cancelled) return;
        asked = true;
        failures = 0;
        // Terminal: the effect is about to be torn down by `terminal`
        // flipping, so stop rather than leave a timer behind it.
        done = next ? subs.isTerminalPayment(next.status) : false;
        if (next) setPayment(next);
      } catch (error) {
        if (cancelled || AbortedError.is(error)) return;
        if (SessionExpiredError.is(error)) {
          exits.current.onSignIn?.();
          return;
        }
        // A failed poll is not news the user has to read — the screen already
        // says what it knows, and the backoff is the answer. Only a failure the
        // user asked for (a tap) is ever surfaced.
        asked = true;
        failures += 1;
        done = false;
      } finally {
        inFlight = false;
      }
      if (!done) schedule();
    };

    schedule();
    // A transfer that lands while the app is away should be on screen the
    // moment it comes back, not up to 45 seconds later.
    const off = onForeground(() => {
      if (timer) clearTimeout(timer);
      void poll();
    });

    return () => {
      off();
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [stage, subId, terminal, recheck, trace]);

  /* ------------------------------------------------------ entitlement sync */

  // Activation propagates asynchronously: a protected route can still 403 for a
  // moment after a settled payment. So this asks, on a bounded backoff, and
  // never creates a second checkout — the money is already in.
  useEffect(() => {
    if (stage !== "enabling") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    let attempt = 0;

    const ask = async () => {
      if (cancelled) return;
      try {
        const entitled = await subs.checkEntitled({ signal: controller.signal });
        if (cancelled) return;
        if (entitled) {
          exits.current.onEntitled();
          return;
        }
      } catch (error) {
        if (cancelled || AbortedError.is(error)) return;
        if (SessionExpiredError.is(error)) {
          exits.current.onSignIn?.();
          return;
        }
        // A refused or unreachable probe is the same wait as a "not yet": the
        // account is not open, and asking again is the only move either way.
      }
      attempt += 1;
      setSyncAttempt(attempt);
      if (attempt >= subs.SYNC_MAX_ATTEMPTS) {
        setStage("support");
        return;
      }
      timer = setTimeout(() => void ask(), subs.syncDelayMs(attempt));
    };

    timer = setTimeout(() => void ask(), subs.syncDelayMs(0));

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
  }, [stage]);

  /* --------------------------------------------------------------- clock */

  useEffect(() => {
    if (stage !== "ready" || terminal || expiryMs === null) return;
    const timer = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(timer);
  }, [stage, terminal, expiryMs]);

  /* -------------------------------------------------------------- actions */

  /**
   * Ask for a deposit address.
   *
   * Only ever reached when there is no live payment. `startCheckout` decides
   * whether that means reusing a persisted key or minting a new one — this
   * never makes that call, because getting it wrong sells two memberships.
   */
  const requestAddress = useCallback(async () => {
    if (busy || !walletAddress) return;
    setBusy(true);
    setNotice(null);
    try {
      const checkout = await subs.startCheckout({
        originChainId: network.chainId,
        originAsset: asset.address,
        refundTo: walletAddress,
      });
      if (!alive.current) return;
      setSubscription(checkout.subscription);
      setPayment(checkout.payment);
      const live = checkout.payment?.originChainId;
      if (typeof live === "number" && subs.networkFor(live)) setChainId(live);
      setStalled(false);
      setStage("ready");
    } catch (error) {
      if (!alive.current) return;
      if (handleSessionLoss(error)) return;
      setNotice(subs.describeFailure(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [busy, walletAddress, network, asset, handleSessionLoss]);

  /** One manual read, for a window that has stopped polling itself. */
  const checkAgain = useCallback(async () => {
    if (busy || !subId) return;
    setBusy(true);
    setNotice(null);
    try {
      const next = await subs.getPayment(subId, { correlationId: trace });
      if (!alive.current) return;
      if (next) setPayment(next);
    } catch (error) {
      if (!alive.current) return;
      if (handleSessionLoss(error)) return;
      setNotice(subs.describeFailure(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [busy, subId, trace, handleSessionLoss]);

  const close = useCallback(() => {
    if (onClose) onClose();
    else onBack?.();
  }, [onClose, onBack]);

  /* --------------------------------------------------------------- render */

  // Both of these read the wall clock, and neither of their inputs changes as
  // it advances. `tick` is therefore a real dependency, not decoration: without
  // it the compiler is entitled to memoize a countdown that never counts and an
  // expiry that never arrives.
  const countdown = useMemo(
    () => (expiryMs === null ? null : formatCountdown(expiryMs)),
    [expiryMs, tick],
  );
  const expired = useMemo(
    () => expiryMs !== null && millisUntil(expiryMs) === 0,
    [expiryMs, tick],
  );

  // 0 below the fold, 1 seated. Started on mount and never restarted — the
  // sheet rises once, and re-running it on a state change would make the panel
  // jump every time the payment status moved.
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(rise, {
      toValue: 1,
      duration: 340,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [rise]);

  const price = formatMoney(subs.priceOf(subscription));
  // One shape whichever side it comes from — "1,000.00 USDC". `formatMoney`
  // prefixes the code for an asset with no symbol, so the fallback has to
  // suppress that or the line reads "USDC 1,000.00 USDC".
  const settlement =
    subs.readSettlementText(payment) ??
    `${formatMoney(subs.MEMBERSHIP_SETTLEMENT, { symbol: false })} ${subs.MEMBERSHIP_SETTLEMENT.currency}`;
  const sheetStyle = {
    maxHeight: height - insets.top - 12,
    backgroundColor: C.sheet,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: C.border,
  } as const;

  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 12,
      }}
    >
      <CircleAction onPress={onBack} size={38} accessibilityLabel="Back">
        <BackChevron color={C.silver} />
      </CircleAction>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Display size={20} style={{ fontFamily: F.displayBold }}>
          Crypto Checkout
        </Display>
      </View>
      <CircleAction onPress={close} size={38} accessibilityLabel="Close">
        <CloseIcon size={16} color={C.silver} />
      </CircleAction>
    </View>
  );

  const planCard = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        backgroundColor: C.raised,
        borderWidth: 1,
        borderColor: C.hairline,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <View style={{ flex: 1 }}>
        {/* The client's artwork reads "PRIMAL PARAGM" / "Montly" — both are
            typos in the mockup, and a paywall is the last place to ship one. */}
        <Label>Paradigm</Label>
        <Display size={18} style={{ marginTop: 6 }}>
          Monthly Subscription
        </Display>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Mono size={22} color={C.text} style={{ fontFamily: F.displayBold }}>
          {price}
        </Mono>
        <Mono size={11.5} color={C.dim} style={{ marginTop: 4 }}>
          {settlement}
        </Mono>
      </View>
    </View>
  );

  const body = (() => {
    /* ------------------------------------------------------------ loading */

    if (stage === "loading") {
      return (
        <View style={{ alignItems: "center", paddingVertical: 54 }}>
          <ParadigmLoader height={26} color={C.silver} />
          <Body size={12.5} color={C.dim} style={{ marginTop: 18 }}>
            Opening your checkout
          </Body>
        </View>
      );
    }

    /* ------------------------------------------------------------- failed */

    if (stage === "failed") {
      return (
        <View>
          {notice ? <Notice notice={notice} /> : null}
          <View style={{ marginTop: 20 }}>
            <MetalButton
              label="Try again"
              onPress={() => setRecheck((n) => n + 1)}
            />
          </View>
        </View>
      );
    }

    /* ---------------------------------------------------------- enabling */

    if (stage === "enabling") {
      return (
        <View style={{ paddingTop: 8 }}>
          <View
            style={{
              alignItems: "center",
              backgroundColor: C.brandGlow,
              borderWidth: 1,
              borderColor: BRAND_EDGE,
              borderRadius: 20,
              paddingVertical: 26,
              paddingHorizontal: 20,
            }}
          >
            <CheckIcon size={26} color={C.brand} />
            <Display size={19} style={{ marginTop: 14, textAlign: "center" }}>
              Payment confirmed.
            </Display>
            <Display size={19} color={C.brand} style={{ textAlign: "center" }}>
              Enabling your account.
            </Display>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              <PulseDot color={C.brand} />
              <Body size={12} color={C.silver}>
                Asking Primal{syncAttempt > 0 ? ` · ${syncAttempt + 1}` : ""}
              </Body>
            </View>
          </View>
          <Body
            size={12}
            color={C.dim}
            style={{ marginTop: 16, lineHeight: 18, textAlign: "center" }}
          >
            Your transfer has settled. Access switches on from Primal's side,
            which usually takes a few seconds — nothing else is needed from you,
            and nothing will be charged again.
          </Body>
        </View>
      );
    }

    /* ----------------------------------------------------------- support */

    if (stage === "support") {
      return (
        <View style={{ paddingTop: 8 }}>
          <View
            style={{
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <Display size={18}>Your payment landed</Display>
            <Body size={12.5} color={C.silver} style={{ marginTop: 8, lineHeight: 19 }}>
              Primal has the money but has not switched your access on yet.
              Nothing is owed and nothing needs paying again — this is ours to
              finish. Quote these to support and they can find it in one look.
            </Body>
            <TraceRow label="Subscription" value={subscription?.id ?? "—"} />
            {payment?.id ? <TraceRow label="Payment" value={payment.id} /> : null}
            <TraceRow label="Reference" value={trace} />
          </View>
          <View style={{ marginTop: 18, gap: 10 }}>
            <MetalButton
              label="Check once more"
              loading={busy}
              onPress={() => {
                setSyncAttempt(0);
                setStage("enabling");
              }}
            />
            <QuietButton label="Close" onPress={close} />
          </View>
        </View>
      );
    }

    /* ------------------------------------------------- terminal, not paid */

    if (terminal && status !== "SETTLED") {
      const expired = status === "EXPIRED";
      return (
        <View style={{ paddingTop: 8 }}>
          <View
            style={{
              backgroundColor: DANGER_TINT,
              borderWidth: 1,
              borderColor: DANGER_EDGE,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <AlertIcon size={17} color={C.down} />
              <Body size={13.5} semibold color={C.down}>
                {expired ? "Payment window closed" : "Payment failed"}
              </Body>
            </View>
            <Body size={12.5} color={C.silver} style={{ marginTop: 10, lineHeight: 19 }}>
              {expired
                ? "This deposit address is no longer watched. Do not send anything to it — start a fresh checkout and you will be given a new one."
                : "Primal could not settle this payment. If anything left your wallet it refunds to the address you started from."}
            </Body>
          </View>
          {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
          <View style={{ marginTop: 18, gap: 10 }}>
            <MetalButton label="Back to membership" onPress={onBack ?? close} />
          </View>
        </View>
      );
    }

    /* ---------------------------------------------- quoted on a bad route */

    // A payment exists but its chain or asset did not resolve out of the
    // trusted table. There is no safe instruction to print here, so none is.
    if (payment && !quote.safe) {
      return (
        <View style={{ paddingTop: 8 }}>
          <View
            style={{
              backgroundColor: DANGER_TINT,
              borderWidth: 1,
              borderColor: DANGER_EDGE,
              borderRadius: 20,
              padding: 18,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <AlertIcon size={17} color={C.down} />
              <Body size={13.5} semibold color={C.down}>
                Do not send anything
              </Body>
            </View>
            <Body size={12.5} color={C.silver} style={{ marginTop: 10, lineHeight: 19 }}>
              This checkout was quoted on a route this app does not recognise,
              so it cannot tell you what to send or where. Nothing has been
              charged. Quote the reference below to support.
            </Body>
            <TraceRow label="Network" value={quote.networkName} />
            {quote.assetAddress ? (
              <TraceRow label="Asset" value={quote.assetAddress} />
            ) : null}
            <TraceRow label="Subscription" value={subscription?.id ?? "—"} />
            <TraceRow label="Reference" value={trace} />
          </View>
          <View style={{ marginTop: 18 }}>
            <MetalButton label="Back to membership" onPress={onBack ?? close} />
          </View>
        </View>
      );
    }

    /* ------------------------------------------------------ route + amount */

    const locked = payment !== null;
    const shownNetwork = locked ? quote.networkName : network.name;
    const shownAsset = locked ? (quote.asset?.symbol ?? "—") : asset.symbol;

    const routeBlock = (
      <View style={{ marginTop: 22 }}>
        <Label>Select asset &amp; network</Label>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <RouteChip
            caption="Asset"
            value={shownAsset}
            selected
            locked
            flex={1}
          />
          <RouteChip
            caption="Network"
            value={shownNetwork}
            selected
            locked={locked}
            open={locked ? undefined : picking}
            onPress={() => setPicking((v) => !v)}
            flex={1.35}
          />
        </View>

        {!locked && picking ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {subs.ORIGIN_NETWORKS.map((n) => {
              const on = n.chainId === chainId;
              return (
                <Pressable
                  key={n.chainId}
                  onPress={() => {
                    setChainId(n.chainId);
                    setPicking(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: PILL,
                    borderWidth: 1,
                    borderColor: on ? C.brand : C.border,
                    backgroundColor: on ? C.brandGlow : C.raised,
                  }}
                >
                  <Body size={12.5} semibold color={on ? C.brand : C.silver}>
                    {n.name}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Body size={11} color={C.dim} style={{ marginTop: 10, lineHeight: 16 }}>
          {locked
            ? "This checkout is bound to the route above. A different network needs a different deposit address, which means a new checkout."
            : "The address you are given only accepts this asset on this network. Anything else is lost."}
        </Body>
      </View>
    );

    /* ------------------------------------------------- nothing to pay yet */

    if (!payment) {
      return (
        <View>
          {planCard}
          {routeBlock}
          {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
          <View style={{ marginTop: 24 }}>
            <MetalButton
              label="Get deposit address"
              loading={busy}
              disabled={!walletAddress}
              onPress={() => void requestAddress()}
            />
          </View>
          <Body
            size={11}
            color={C.dim}
            style={{ marginTop: 14, textAlign: "center", lineHeight: 17 }}
          >
            {walletAddress
              ? "A failed route refunds to your own wallet."
              : "Unlock your wallet first — a payment needs somewhere to refund to if the route fails."}
          </Body>
        </View>
      );
    }

    /* ------------------------------------------------------- live payment */

    const groups = subs.addressGroups(payment.depositAddress);
    const edges = subs.addressEdges(payment.depositAddress);
    const grossed = isGrossedUp(payment, quote.asset);
    const shut = stalled || expired;

    const statusStrip = (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          marginTop: 16,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.hairline,
          borderRadius: 14,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <PulseDot color={status === "PROCESSING" ? C.brand : C.amber} />
        <Body size={12.5} color={C.silver} style={{ flex: 1 }}>
          {shut ? "Window closed" : subs.describePaymentStatus(status)}
        </Body>
        {countdown && !shut ? (
          <Mono size={12} color={C.text}>
            {countdown}
          </Mono>
        ) : null}
      </View>
    );

    const addressBlock = (
      <View style={{ marginTop: 22 }}>
        <Label>Deposit address</Label>
        <Pressable
          onPress={() => void copy("addr", payment.depositAddress)}
          accessibilityRole="button"
          accessibilityLabel="Copy deposit address"
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: copied === "addr" ? BRAND_EDGE : C.border,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          {/* The whole string, in groups. Never `0x8335…2913` — that ellipsis
              is the entire address-poisoning attack surface. */}
          <Mono
            size={12.5}
            color={C.text}
            style={{ flex: 1, lineHeight: 20, fontFamily: F.monoSemibold }}
          >
            {groups.join(" ")}
          </Mono>
          <CopyMark copied={copied === "addr"} label="COPY" />
        </Pressable>

        <Pressable
          onPress={() => setReviewing((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: reviewing }}
          style={{ paddingVertical: 10 }}
        >
          <Body size={12} semibold color={C.brand}>
            {reviewing ? "Hide full address" : "Review the full address"}
          </Body>
        </Pressable>

        {reviewing ? (
          <View
            style={{
              backgroundColor: C.inset,
              borderWidth: 1,
              borderColor: C.hairline,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <Body size={12} color={C.silver} style={{ lineHeight: 18 }}>
              Paste it, then compare the gold characters at both ends against
              what your wallet shows. An address that differs anywhere is not
              this one.
            </Body>
            <Mono size={14} style={{ marginTop: 14, lineHeight: 24 }}>
              <Mono size={14} color={C.brand} style={{ fontFamily: F.monoSemibold }}>
                {edges.head}
              </Mono>
              <Mono size={14} color={C.text}>
                {edges.middle}
              </Mono>
              <Mono size={14} color={C.brand} style={{ fontFamily: F.monoSemibold }}>
                {edges.tail}
              </Mono>
            </Mono>
            <View style={{ marginTop: 14, gap: 4 }}>
              <Body size={11.5} color={C.dim}>
                {quote.networkName}
                {quote.chainId === null ? "" : ` · chain ${quote.chainId}`}
              </Body>
              {quote.assetAddress ? (
                <Mono size={10.5} color={C.dim} style={{ lineHeight: 15 }}>
                  {quote.asset?.symbol} contract {quote.assetAddress}
                </Mono>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );

    const amountBlock = (
      <View style={{ marginTop: 22 }}>
        <Label>Send exactly</Label>
        <Pressable
          onPress={() =>
            quote.amountPlain ? void copy("amount", quote.amountPlain) : undefined
          }
          disabled={!quote.amountPlain}
          accessibilityRole="button"
          accessibilityLabel="Copy the amount to send"
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 12,
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: copied === "amount" ? BRAND_EDGE : C.border,
            borderRadius: 16,
            paddingVertical: 15,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flex: 1 }}>
            {/* The exact `originAmount`, at the trusted table's decimals. */}
            <Mono size={24} color={C.text} style={{ fontFamily: F.displayBold }}>
              {quote.amountText}
            </Mono>
            <Body size={12} color={C.sub} style={{ marginTop: 4 }}>
              {quote.asset?.symbol} on {quote.networkName}
            </Body>
          </View>
          <View style={{ paddingBottom: 4 }}>
            <CopyMark copied={copied === "amount"} label="COPY" />
          </View>
        </Pressable>
        {grossed ? (
          <Body size={11} color={C.dim} style={{ marginTop: 9, lineHeight: 16 }}>
            More than the {settlement} that has to settle — the difference is the
            route's fee, already worked in. Send the figure above, not the plan
            price.
          </Body>
        ) : null}
      </View>
    );

    const warning = (
      <View
        style={{
          flexDirection: "row",
          gap: 11,
          marginTop: 22,
          backgroundColor: DANGER_TINT,
          borderWidth: 1,
          borderColor: DANGER_EDGE,
          borderRadius: 16,
          padding: 14,
        }}
      >
        <View style={{ paddingTop: 1 }}>
          <AlertIcon size={17} color={C.down} />
        </View>
        <Body size={12.5} color={C.silver} style={{ flex: 1, lineHeight: 18 }}>
          Confirm that the wallet address and network above match your sending
          wallet before continuing.
        </Body>
      </View>
    );

    /* The window has shut but the gateway has not said so yet. The loop has
       spent its final check, so from here it is the user's call. */
    if (shut) {
      return (
        <View>
          {planCard}
          {statusStrip}
          <View
            style={{
              marginTop: 16,
              backgroundColor: DANGER_TINT,
              borderWidth: 1,
              borderColor: DANGER_EDGE,
              borderRadius: 16,
              padding: 14,
            }}
          >
            <Body size={12.5} color={C.silver} style={{ lineHeight: 18 }}>
              The payment window has closed. Do not send anything to the address
              you were given. If you sent before it closed, check once more —
              Primal decides whether it counted, not this app.
            </Body>
          </View>
          {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
          <View style={{ marginTop: 20, gap: 10 }}>
            <MetalButton
              label="Check once more"
              loading={busy}
              onPress={() => void checkAgain()}
            />
            <QuietButton label="Back to membership" onPress={onBack ?? close} />
          </View>
        </View>
      );
    }

    /* The watching beat: everything still on screen, weighted differently. */
    if (acknowledged) {
      return (
        <View>
          {planCard}
          {statusStrip}
          {amountBlock}
          {addressBlock}
          {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
          <Body
            size={12}
            color={C.dim}
            style={{ marginTop: 18, lineHeight: 18, textAlign: "center" }}
          >
            Watching for your transfer. You can close this — it keeps running,
            and your subscription switches on the moment it confirms.
          </Body>
          <View style={{ marginTop: 16 }}>
            <QuietButton label="Close" onPress={close} />
          </View>
        </View>
      );
    }

    return (
      <View>
        {planCard}
        {routeBlock}
        {amountBlock}
        {addressBlock}
        {warning}
        {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
        <View style={{ marginTop: 22 }}>
          <MetalButton label="Continue" onPress={() => setAcknowledged(true)} />
        </View>
        <Body
          size={11}
          color={C.dim}
          style={{ marginTop: 14, textAlign: "center", lineHeight: 17 }}
        >
          Your subscription unlocks instantly upon transaction confirmation.
        </Body>
      </View>
    );
  })();

  return (
    <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: SCRIM }}>
      <Pressable
        style={{ flex: 1 }}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Dismiss checkout"
      />
      {/* The rise is here rather than on the route. The route's own transition
          moves the whole screen — scrim included — which reads as a page swap;
          a drawer is the scrim fading in place while the panel travels up over
          it. Native driver: transform only, nothing that touches layout. */}
      <Animated.View
        style={[
          sheetStyle,
          {
            transform: [
              {
                translateY: rise.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height * 0.5, 0],
                }),
              },
            ],
          },
        ]}
      >
        {header}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 20,
          }}
        >
          {body}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
