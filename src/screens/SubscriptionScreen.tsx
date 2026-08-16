import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  Body,
  Card,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  PulseDot,
  Screen,
  SectionRule,
  Spinner,
} from "@/components/ui";
import { formatMoney } from "@/lib/gateway/money";
import * as subs from "@/lib/gateway/subscription";
import { formatCountdown, toDate } from "@/lib/gateway/time";
import {
  SessionExpiredError,
  type PrimalAppState,
  type Subscription,
} from "@/lib/gateway/types";
import { C, F } from "@/theme/tokens";

/**
 * The membership screen — paywall and management on one surface.
 *
 * This is where a 403 ACTIVE_SUBSCRIPTION_REQUIRED lands. It wears two faces,
 * chosen by the app state the GATEWAY handed us, never by anything decided here:
 *
 * - Not entitled → the price, what the money buys, and one primary action.
 * - Entitled     → status, when it renews, and how to stop it.
 *
 * The one thing it must never do is create a second checkout. A payment already
 * in flight is picked up (`resumeCheckout`), not replaced, and the primary
 * action goes through `startCheckout`, which reuses the persisted idempotency
 * key rather than minting a fresh one.
 */

/** What membership opens. Written against what the app actually ships. */
const INCLUDED: { title: string; detail: string }[] = [
  {
    title: "A Nigerian account in your name",
    detail: "Naira in from any bank or app, out to any account.",
  },
  {
    title: "Airtime, data and bills",
    detail: "Paid straight from your balance, no top-up dance.",
  },
  {
    title: "Crypto rails",
    detail: "Buy, hold and move stablecoins beside your naira.",
  },
  {
    title: "One membership, everything on",
    detail: "No per-transfer subscription, no tiering.",
  },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Deliberately not `toLocaleDateString` — Intl availability varies by engine
 *  and build, and a renewal date that renders as "Invalid Date" is worse than
 *  a plain one. */
function formatDay(value: unknown): string | null {
  const date = toDate(value as never);
  if (!date) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function Tick() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={C.brand}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
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
      style={{
        marginTop: 16,
        backgroundColor: "rgba(246,165,165,0.1)",
        borderWidth: 1,
        borderColor: "rgba(246,165,165,0.35)",
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

export interface SubscriptionScreenProps {
  /** Backend-derived. Which face this screen wears, and nothing local. */
  state: PrimalAppState;
  /** Refund destination if the payment route fails — the user's own wallet. */
  walletAddress: string | null;
  /** Hand off to the checkout route with the subscription that owns the payment. */
  onOpenCheckout: (subscriptionId: string) => void;
  onBack?: () => void;
  /** The session died mid-flight; the route sends them to sign in. */
  onSignIn?: () => void;
  /** Re-probe entitlement after a cancellation changes it. */
  onEntitlementChanged?: () => void | Promise<void>;
}

export default function SubscriptionScreen({
  state,
  walletAddress,
  onOpenCheckout,
  onBack,
  onSignIn,
  onEntitlementChanged,
}: SubscriptionScreenProps) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<subs.FailureNotice | null>(null);
  const [membership, setMembership] = useState<Subscription | null>(null);
  const [pending, setPending] = useState<subs.Checkout | null>(null);
  const [confirmImmediate, setConfirmImmediate] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const entitled = state === "active" || state === "cancel_at_period_end";

  const handleSessionLoss = useCallback(
    (error: unknown): boolean => {
      if (!SessionExpiredError.is(error)) return false;
      onSignIn?.();
      return true;
    },
    [onSignIn],
  );

  // Pick up whatever this device already has, without creating anything. A
  // half-finished payment must reappear here, or the user starts a second one.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const existing = await subs.resumeCheckout({ signal: controller.signal });
        if (!alive.current) return;
        if (existing) {
          setMembership(existing.subscription);
          const status = existing.payment?.status ?? "UNKNOWN";
          setPending(subs.isPayablePayment(status) ? existing : null);
        }
      } catch (error) {
        // A failed probe is not an error the user has to read: the primary
        // action performs the same lookup and reports properly if it fails.
        if (alive.current) handleSessionLoss(error);
      } finally {
        if (alive.current) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [handleSessionLoss]);

  // One clock, only while a payment window is actually counting down.
  useEffect(() => {
    if (!pending?.payment?.expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [pending]);

  const start = useCallback(async () => {
    if (busy || !walletAddress) return;
    setBusy(true);
    setNotice(null);
    try {
      const checkout = await subs.startCheckout({
        originChainId: subs.DEFAULT_ORIGIN_CHAIN_ID,
        originAsset: subs.defaultOriginAsset().address,
        refundTo: walletAddress,
      });
      if (!alive.current) return;
      setMembership(checkout.subscription);
      onOpenCheckout(checkout.subscription.id);
    } catch (error) {
      if (!alive.current) return;
      if (handleSessionLoss(error)) return;
      setNotice(subs.describeFailure(error));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [busy, walletAddress, onOpenCheckout, handleSessionLoss]);

  const cancel = useCallback(
    async (atPeriodEnd: boolean) => {
      if (cancelling || !membership) return;
      setCancelling(true);
      setNotice(null);
      try {
        const updated = await subs.cancelSubscription(membership.id, atPeriodEnd);
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

  const price = formatMoney(subs.priceOf(membership));

  /* ------------------------------------------------------------- loading */

  if (loading) {
    return (
      <Screen center>
        <Spinner size="large" />
        <Body size={12.5} color={C.dim} style={{ marginTop: 16 }}>
          Checking your membership
        </Body>
      </Screen>
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
      <Screen top={12}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Display size={22}>Membership</Display>
          <View style={{ flex: 1 }} />
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button">
              <Body size={12.5} color={C.dim}>
                Close
              </Body>
            </Pressable>
          ) : null}
        </View>

        <Card style={{ marginTop: 18, padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: ending ? C.amber : C.up,
              }}
            />
            <Mono size={10} color={ending ? C.amber : C.up} style={{ letterSpacing: 1.4 }}>
              {subs
                .describeSubscriptionStatus(membership?.status ?? "ACTIVE")
                .toUpperCase()}
            </Mono>
          </View>

          <Display size={30} style={{ marginTop: 12 }}>
            {price}
          </Display>
          <Body size={12.5} color={C.sub} style={{ marginTop: 6 }}>
            per {subs.MEMBERSHIP_PERIOD}
            {renews ? (ending ? ` · access ends ${renews}` : ` · renews ${renews}`) : ""}
          </Body>
        </Card>

        {ending ? (
          <Body size={12.5} color={C.sub} style={{ marginTop: 18, lineHeight: 19 }}>
            Your membership is set to end{renews ? ` on ${renews}` : " at the end of this period"}.
            Everything keeps working until then.
          </Body>
        ) : membership ? (
          <>
            <SectionRule space={22} />
            {confirmImmediate ? (
              <View
                style={{
                  backgroundColor: "rgba(246,165,165,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(246,165,165,0.3)",
                  borderRadius: 20,
                  padding: 18,
                }}
              >
                <Body size={14} semibold color={C.down}>
                  End access now?
                </Body>
                <Body size={12.5} color={C.silver} style={{ marginTop: 8, lineHeight: 19 }}>
                  Your account, transfers and bill payments stop the moment this
                  goes through — not at the end of the month you have paid for.
                  There is no refund for the remaining days.
                </Body>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
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
                    style={{ flex: 1, borderColor: "rgba(246,165,165,0.45)" }}
                  />
                </View>
              </View>
            ) : (
              <>
                <Label>Ending it</Label>
                <Body size={12.5} color={C.sub} style={{ marginTop: 8, lineHeight: 19 }}>
                  Stopping at the end of the period keeps everything working
                  until{renews ? ` ${renews}` : " it runs out"}. Ending now is immediate.
                </Body>
                <View style={{ marginTop: 16, gap: 10 }}>
                  <GhostButton
                    label="Stop renewing"
                    onPress={() => void cancel(true)}
                    loading={cancelling}
                  />
                  <Pressable
                    onPress={() => setConfirmImmediate(true)}
                    accessibilityRole="button"
                    style={{ alignItems: "center", paddingVertical: 10 }}
                  >
                    <Body size={12} color={C.dim}>
                      End access immediately
                    </Body>
                  </Pressable>
                </View>
              </>
            )}
          </>
        ) : (
          <Body size={12} color={C.dim} style={{ marginTop: 18, lineHeight: 18 }}>
            Renewal details are not available on this device. Sign in on the
            device that started the membership to manage it.
          </Body>
        )}

        {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}
      </Screen>
    );
  }

  /* ------------------------------------------------------------- paywall */

  const expiredBefore = state === "expired";
  const waiting = state === "entitlement_syncing";
  const pendingExpiry = pending?.payment?.expiresAt;
  // `formatCountdown` reads the clock itself, so `now` is the dependency that
  // makes it recompute — it is the tick, not an input.
  const pendingCountdown = pendingExpiry ? formatCountdown(pendingExpiry) : null;
  void now;

  return (
    <Screen top={12}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Label>Paradigm</Label>
        <View style={{ flex: 1 }} />
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button">
            <Body size={12.5} color={C.dim}>
              Close
            </Body>
          </Pressable>
        ) : null}
      </View>

      <Display size={30} style={{ marginTop: 16 }}>
        {expiredBefore ? "Your membership has ended" : "Membership"}
      </Display>
      <Body size={13} color={C.sub} style={{ marginTop: 8, lineHeight: 19 }}>
        {expiredBefore
          ? "Start it again to bring your account, transfers and rails back."
          : "One membership opens the whole app — the account, the rails and the crypto side."}
      </Body>

      {waiting ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            marginTop: 16,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 14,
            padding: 13,
          }}
        >
          <PulseDot />
          <Body size={12} color={C.silver} style={{ flex: 1, lineHeight: 17 }}>
            Your payment is confirmed. Primal is still enabling the account —
            this usually takes under a minute.
          </Body>
        </View>
      ) : null}

      {/* A payment already in flight. Nothing on this screen may start a second
          one while this is live. */}
      {pending ? (
        <Pressable
          onPress={() => onOpenCheckout(pending.subscription.id)}
          accessibilityRole="button"
          accessibilityLabel="Open the payment in progress"
          style={{
            marginTop: 18,
            backgroundColor: C.brandGlow,
            borderWidth: 1,
            borderColor: "rgba(131,190,96,0.35)",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot color={C.brand} />
            <Mono size={10} color={C.brandSoft} style={{ letterSpacing: 1.4 }}>
              PAYMENT IN PROGRESS
            </Mono>
          </View>
          <Body size={13} color={C.text} style={{ marginTop: 8, lineHeight: 18 }}>
            You have a checkout open on this device
            {pendingCountdown ? ` — it expires in ${pendingCountdown}` : ""}.
          </Body>
          <Body size={12} semibold color={C.brand} style={{ marginTop: 10 }}>
            Open it
          </Body>
        </Pressable>
      ) : null}

      <View
        style={{
          marginTop: 22,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 22,
          padding: 20,
        }}
      >
        <Label>Price</Label>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 10 }}>
          <Display size={40}>{price}</Display>
          <Body size={13} color={C.sub} style={{ paddingBottom: 6 }}>
            / {subs.MEMBERSHIP_PERIOD}
          </Body>
        </View>
        <Mono size={10} color={C.dim} style={{ marginTop: 10, letterSpacing: 1.2 }}>
          PAID IN USDC ON {subs
            .networkFor(subs.DEFAULT_ORIGIN_CHAIN_ID)!
            .name.toUpperCase()}
        </Mono>
      </View>

      <View style={{ marginTop: 24, gap: 16 }}>
        {INCLUDED.map((item) => (
          <View key={item.title} style={{ flexDirection: "row", gap: 12 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: C.brandGlow,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <Tick />
            </View>
            <View style={{ flex: 1 }}>
              <Body size={13.5} semibold>
                {item.title}
              </Body>
              <Body size={12} color={C.dim} style={{ marginTop: 3, lineHeight: 17 }}>
                {item.detail}
              </Body>
            </View>
          </View>
        ))}
      </View>

      {notice ? <Notice notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <View style={{ marginTop: 28 }}>
        {pending ? (
          <MetallicButton
            label="Open your payment"
            onPress={() => onOpenCheckout(pending.subscription.id)}
          />
        ) : (
          <MetallicButton
            label={busy ? "Preparing checkout…" : "Start membership"}
            onPress={() => void start()}
            loading={busy}
            disabled={!walletAddress}
          />
        )}
      </View>

      <Body
        size={11}
        color={C.dim}
        style={{ marginTop: 14, textAlign: "center", lineHeight: 17 }}
      >
        {walletAddress
          ? `Billed monthly. Cancel any time — you keep the period you have paid for. A failed route refunds to ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}.`
          : "Unlock your wallet to start a membership — a payment needs somewhere to refund to if the route fails."}
      </Body>
    </Screen>
  );
}
