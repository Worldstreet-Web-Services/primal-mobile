import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { CopyMark, useCopy } from "../components/CopyAction";
import {
  BackHeader,
  Body,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  Pulse,
  PulseDot,
  Screen,
  SectionRule,
  Shine,
} from "../components/ui";
import { useLinkpayAccount } from "../hooks/useLinkpay";
import {
  accountStatusLabel,
  depositStatusLabel,
  describeLinkpayFailure,
  watchDeposits,
} from "../lib/gateway/linkpay";
import { formatMoney } from "../lib/gateway/money";
import { SessionExpiredError, type Deposit } from "../lib/gateway/types";
import { C, F } from "../theme/tokens";

/**
 * Money in, by bank transfer.
 *
 * The earlier build of this screen asked for an amount and issued a one-off
 * account that expired in thirty minutes. That was a fiction: LinkPay gives a
 * user ONE permanent account number, deposits are provider-initiated, and
 * nothing on our side knows or cares how much is coming. So the screen now does
 * what the rail actually does — hands over the real account details and watches
 * the deposit feed.
 *
 * The settlement narration follows the backend's own two-step vocabulary:
 * `DETECTED` (the provider has seen the transfer) then `CREDITED` (it is in the
 * balance). Nothing is claimed between them.
 */

/** Polite: the gateway allows 120 requests a window and this screen may sit open. */
const POLL_MS = 6_000;
/** Stop watching after this long rather than polling until the battery dies. */
const WATCH_MS = 20 * 60 * 1000;

function CheckSeal() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M4.5 12.5 9.5 17.5 19.5 6.5"
        stroke={C.up}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** A quiet detail line under the account card — copyable, but not shouting. */
function DetailRow({
  label,
  value,
  copied,
  onPress,
  last,
}: {
  label: string;
  value: string;
  copied: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={"Copy " + label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <Mono size={10} color={C.dim} style={{ letterSpacing: 1.3 }}>
        {label.toUpperCase()}
      </Mono>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
        <Mono size={12.5} color={C.text}>
          {value}
        </Mono>
        <CopyMark copied={copied} />
      </View>
    </Pressable>
  );
}

function Gate({
  title,
  body,
  action,
  onAction,
  tone = "quiet",
  pending,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  tone?: "quiet" | "warn" | "bad";
  pending?: boolean;
}) {
  const edge =
    tone === "bad"
      ? "rgba(246,165,165,0.35)"
      : tone === "warn"
        ? "rgba(245,184,61,0.32)"
        : C.border;
  return (
    <View
      style={{
        marginTop: 28,
        backgroundColor: tone === "bad" ? "rgba(246,165,165,0.08)" : C.raised,
        borderWidth: 1,
        borderColor: edge,
        borderRadius: 20,
        padding: 20,
        overflow: "hidden",
      }}
    >
      <Shine />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        {pending ? <PulseDot /> : null}
        <Display size={18}>{title}</Display>
      </View>
      <Body
        size={12.5}
        color={tone === "bad" ? C.down : C.sub}
        style={{ marginTop: 12, lineHeight: 19 }}
      >
        {body}
      </Body>
      {action ? (
        <View style={{ marginTop: 20 }}>
          <MetallicButton label={action} height={48} radius={14} size={13.5} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export default function FundBankScreen({
  onBack,
  onDone,
  onProvision,
  onNeedsSubscription,
  onNeedsSignIn,
}: {
  onBack?: () => void;
  onDone?: () => void;
  onProvision?: () => void;
  onNeedsSubscription?: () => void;
  onNeedsSignIn?: () => void;
}) {
  const { phase, account, error: accountError, reload } = useLinkpayAccount();
  const { copied, copy } = useCopy();

  /** The transfer this visit is about, once the provider has seen one. */
  const [incoming, setIncoming] = useState<Deposit | null>(null);
  const [credited, setCredited] = useState<Deposit | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  /** Ids that were already in the feed when this screen opened. */
  const seen = useRef<Set<string> | null>(null);
  /** The one deposit being narrated, so a later tick can follow its status. */
  const tracking = useRef<string | null>(null);

  // The account card is placed, not rendered: it rises and settles once, the
  // way a teller slides a card across the counter. The one motion moment here.
  const place = useRef(new Animated.Value(0)).current;

  const told = useRef(false);
  useEffect(() => {
    if (phase !== "unentitled") {
      told.current = false;
      return;
    }
    if (told.current) return;
    told.current = true;
    onNeedsSubscription?.();
  }, [phase, onNeedsSubscription]);

  useEffect(() => {
    if (phase !== "ready") return;
    place.setValue(0);
    Animated.spring(place, {
      toValue: 1,
      useNativeDriver: true,
      speed: 11,
      bounciness: 5,
    }).start();
  }, [phase, place]);

  // One clock for the "checked Ns ago" line.
  useEffect(() => {
    if (phase !== "ready" || credited) return;
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(clock);
  }, [phase, credited]);

  // Watch the deposit feed. The first tick is a baseline, not news: a transfer
  // from last week must not announce itself as the one being waited for.
  useEffect(() => {
    if (phase !== "ready") return;

    const stop = watchDeposits(
      (deposits) => {
        setLastChecked(Date.now());
        setFeedError(null);

        if (seen.current === null) {
          seen.current = new Set(deposits.map((d) => d.id));
          const inflight = deposits.find((d) => d.status === "DETECTED");
          if (inflight) {
            tracking.current = inflight.id;
            setIncoming(inflight);
          }
          return false;
        }

        const fresh = deposits.find((d) => d.id !== "" && !seen.current!.has(d.id));
        const followed = tracking.current
          ? deposits.find((d) => d.id === tracking.current)
          : undefined;
        const subject = fresh ?? followed;
        if (!subject) return false;

        tracking.current = subject.id;
        if (subject.status === "CREDITED") {
          setCredited(subject);
          return true;
        }
        setIncoming(subject);
        // REJECTED is terminal too, and the row says so rather than spinning.
        return subject.status === "REJECTED";
      },
      {
        intervalMs: POLL_MS,
        maxMs: WATCH_MS,
        onError: (err) => {
          if (SessionExpiredError.is(err)) return;
          setFeedError(describeLinkpayFailure(err));
        },
      },
    );

    return stop;
  }, [phase]);

  const header = (title: string, sub?: string) => (
    <View style={{ paddingHorizontal: 0 }}>
      <BackHeader title={title} onBack={onBack} />
      {sub ? (
        <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
          {sub}
        </Body>
      ) : null}
    </View>
  );

  /* ------------------------------------------------------------- gates */

  if (phase === "loading") {
    return (
      <Screen>
        {header("Bank transfer")}
        <View style={{ marginTop: 26, gap: 14 }}>
          <Pulse height={120} radius={22} />
          <Pulse height={56} radius={16} />
          <Pulse width="60%" height={12} />
        </View>
      </Screen>
    );
  }

  if (phase !== "ready") {
    const gate = () => {
      switch (phase) {
        case "signed_out":
          return (
            <Gate
              title="Sign in first"
              body="Your account number belongs to your Paradigm identity, so it comes back when you sign in."
              action="Sign in"
              onAction={onNeedsSignIn}
            />
          );
        case "unentitled":
          return (
            <Gate
              title="Subscription required"
              body="Naira deposits are part of a Paradigm subscription. Your sign-in is fine — the subscription is what is missing."
              action="See the plan"
              onAction={onNeedsSubscription}
            />
          );
        case "no_account":
          return (
            <Gate
              title="You need an account number first"
              body="A one-time check opens a naira account in your own name. Money sent to it lands in Paradigm."
              action="Open my account"
              onAction={onProvision}
            />
          );
        case "provisioning":
          return (
            <Gate
              tone="warn"
              pending
              title="Your account is being opened"
              body="The bank is still working on it. As soon as there is a number to transfer into, it appears here."
              action="Check now"
              onAction={reload}
            />
          );
        case "provision_failed":
          return (
            <Gate
              tone="bad"
              title="That account could not be opened"
              body={
                account?.failureReason ??
                "The bank turned down the details we sent. Check them and try again."
              }
              action="Try again"
              onAction={onProvision}
            />
          );
        case "disabled":
          return (
            <Gate
              tone="bad"
              title="This account is disabled"
              body="Transfers into it would be returned, so the details are not shown. Support can turn it back on."
            />
          );
        case "unknown_status":
          return (
            <Gate
              tone="warn"
              title={`Account status: ${accountStatusLabel(account?.status ?? "UNKNOWN")}`}
              body="Paradigm does not recognise the state your account is in, and will not hand out a number it cannot vouch for."
              action="Check again"
              onAction={reload}
            />
          );
        default:
          return (
            <Gate
              tone="bad"
              title="Could not load your account"
              body={accountError ?? "Something went wrong reaching Paradigm."}
              action="Try again"
              onAction={reload}
            />
          );
      }
    };

    return (
      <Screen>
        {header("Bank transfer")}
        {gate()}
      </Screen>
    );
  }

  /* ------------------------------------------------------------- credited */

  if (credited) {
    return (
      <Screen center>
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: C.upBg,
            borderWidth: 1,
            borderColor: "rgba(124,231,176,0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CheckSeal />
        </View>
        <Display size={23} style={{ marginTop: 20 }}>
          Credited to your balance
        </Display>
        <Text
          style={{
            fontFamily: F.monoSemibold,
            fontSize: 30,
            lineHeight: 38,
            color: C.up,
            marginTop: 14,
          }}
        >
          {formatMoney(credited.amount)}
        </Text>
        <Body
          size={12.5}
          color={C.sub}
          style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}
        >
          {credited.senderName ? `From ${credited.senderName}.\n` : ""}
          Spend it anywhere in the app.
        </Body>
        <View style={{ marginTop: 30, alignSelf: "stretch" }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </Screen>
    );
  }

  /* --------------------------------------------------------------- account */

  const number = account?.accountNumber ?? "";
  const detected = incoming?.status === "DETECTED";
  const rejected = incoming?.status === "REJECTED";
  const checkedAgo =
    lastChecked === null ? null : Math.max(0, Math.round((now - lastChecked) / 1000));

  return (
    <Screen>
      {header(
        "Bank transfer",
        "Send naira to this account from any Nigerian bank or app. It is yours — any amount, as often as you like.",
      )}

      <Animated.View
        style={{
          marginTop: 18,
          opacity: place,
          transform: [
            { translateY: place.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
            { scale: place.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        }}
      >
        <View
          style={{
            backgroundColor: C.raised,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 24,
            overflow: "hidden",
          }}
        >
          <Shine />

          {/* Header band: whose account this is, and that it does not expire. */}
          <View
            style={{
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 14,
              backgroundColor: C.brandGlow,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(131,190,96,0.28)",
            }}
          >
            <Label style={{ color: C.brandSoft }}>Your naira account</Label>
            <Body size={13.5} semibold style={{ marginTop: 7 }}>
              {account?.accountName ?? "In your name"}
            </Body>
            <Mono size={10} color={C.dim} style={{ marginTop: 6, letterSpacing: 1.2 }}>
              PERMANENT · NO EXPIRY
            </Mono>
          </View>

          {/* The number itself — the one figure this whole screen exists
              to hand over. */}
          <Pressable
            onPress={() => void copy("number", number.replace(/\s/g, ""))}
            accessibilityRole="button"
            accessibilityLabel="Copy account number"
            style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 }}
          >
            <Label>Account number</Label>
            <Text
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 27,
                lineHeight: 34,
                letterSpacing: 2.5,
                color: C.text,
                marginTop: 9,
              }}
            >
              {number || "—"}
            </Text>
            <View style={{ marginTop: 12, alignSelf: "flex-start" }}>
              <CopyMark copied={copied === "number"} label="COPY NUMBER" />
            </View>
          </Pressable>

          <View
            style={{ paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: C.hairline }}
          >
            <DetailRow
              label="Bank"
              value={account?.bankName ?? "—"}
              copied={copied === "bank"}
              onPress={() => void copy("bank", account?.bankName ?? "")}
            />
            <DetailRow
              label="Account name"
              value={account?.accountName ?? "—"}
              copied={copied === "name"}
              onPress={() => void copy("name", account?.accountName ?? "")}
              last
            />
          </View>
        </View>
      </Animated.View>

      <Body size={11.5} color={C.dim} style={{ marginTop: 14, lineHeight: 17.5 }}>
        Transfers are credited once the provider confirms them. Paradigm does not ask you for an
        exact figure — send whatever you mean to send.
      </Body>

      <View
        style={{
          marginTop: 22,
          paddingTop: 18,
          borderTopWidth: 1,
          borderTopColor: C.hairline,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
          }}
        >
          {detected ? (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.up }} />
          ) : rejected ? null : (
            <PulseDot />
          )}
          <Body size={13} color={detected ? C.up : rejected ? C.down : C.silver}>
            {detected
              ? `Transfer detected${incoming?.amount ? ` · ${formatMoney(incoming.amount)}` : ""} — crediting now`
              : rejected
                ? "That transfer was returned rather than credited"
                : "Watching for your transfer"}
          </Body>
        </View>
        <Mono
          size={10}
          color={C.dim}
          style={{ textAlign: "center", marginTop: 8, letterSpacing: 1.2 }}
        >
          {incoming
            ? `STATUS · ${depositStatusLabel(incoming.status).toUpperCase()}`
            : checkedAgo === null
              ? "STANDING BY"
              : `CHECKED ${checkedAgo}S AGO`}
        </Mono>
        {feedError ? (
          <Body size={11.5} color={C.down} style={{ textAlign: "center", marginTop: 10 }}>
            {feedError}
          </Body>
        ) : null}
      </View>

      <SectionRule space={20} />

      <GhostButton label="Done" onPress={onDone} />
    </Screen>
  );
}
