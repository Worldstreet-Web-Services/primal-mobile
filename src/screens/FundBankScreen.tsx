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
/**
 * The backstop for when the screen must stop SAYING it is watching.
 *
 * `onStopped` is the exact answer and is preferred, but the poll can only
 * notice its own deadline when its own timer fires, and a phone that spent
 * those twenty minutes asleep does not fire it until it wakes. So the elapsed
 * wall clock is read as well: `startPolling` gives up as soon as one more
 * interval would overshoot `maxMs`, so taking the earlier of the two bounds
 * means the pulse dot can be a beat early but never a lie. A spinner over
 * someone's money after the asking has stopped is the defect, not the stopping.
 */
const WATCH_ENDS_MS = WATCH_MS - POLL_MS;
/** Said to the user, so it is derived from the constant rather than typed. */
const WATCH_MINUTES = Math.round(WATCH_MS / 60_000);

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
  const {
    phase,
    account,
    error: accountError,
    activation,
    watching,
    reload,
  } = useLinkpayAccount();
  const { copied, copy } = useCopy();

  /** The transfer this visit is about, once the provider has seen one. */
  const [incoming, setIncoming] = useState<Deposit | null>(null);
  const [credited, setCredited] = useState<Deposit | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** When the current watch was armed — the clock the expiry is read off. */
  const [watchStartedAt, setWatchStartedAt] = useState<number | null>(null);
  /**
   * When the poll told us it gave up — exact, where the clock below is a
   * backstop. The instant matters and not just the fact: `onStopped` fires for
   * a lost session as readily as for the deadline, and comparing THIS against
   * the start is the only way to tell the two apart from here.
   */
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  /** Bumped to arm a fresh watch after the last one ran out. */
  const [watchNonce, setWatchNonce] = useState(0);

  /** Ids that were already in the feed when this screen opened. */
  const seen = useRef<Set<string> | null>(null);
  /** The one deposit being narrated, so a later tick can follow its status. */
  const tracking = useRef<string | null>(null);

  // The account card is placed, not rendered: it rises and settles once, the
  // way a teller slides a card across the counter. The one motion moment here.
  const place = useRef(new Animated.Value(0)).current;

  // `unentitled` only — a payment still in flight, or an entitlement still
  // propagating, is `activating` and gets the wait below instead of a paywall.
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
  //
  // `onStopped` is the poll saying it has given up — on the deadline, on a
  // terminal deposit, or on a lost session. The wall-clock start is recorded
  // alongside it because that callback rides the poll's own timer, and a phone
  // that spent those twenty minutes asleep does not run it until it wakes.
  // Reading elapsed time off `now` survives suspension, because both are wall
  // clock; whichever notices first is the one the screen believes.
  useEffect(() => {
    if (phase !== "ready") return;
    setWatchStartedAt(Date.now());
    setStoppedAt(null);

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
        onStopped: () => setStoppedAt(Date.now()),
      },
    );

    return stop;
  }, [phase, watchNonce]);

  /**
   * Watch again, on a tap.
   *
   * Deliberately not automatic: once the watch has run out, the person holding
   * the phone is the one who knows whether a transfer is still coming, and a
   * poll that re-arms itself is how a screen ends up asking until the battery
   * dies — which is the thing WATCH_MS exists to prevent.
   *
   * A returned transfer is let go of here rather than followed. It is finished,
   * and a re-armed watch still tracking it would match it on the very first
   * tick and stop again at once — a control that promises to look and doesn't.
   * A DETECTED one is kept, because that is still the transfer being waited on.
   */
  const restartWatch = () => {
    if (tracking.current && incoming?.status === "REJECTED") {
      // Into the baseline, so the fresh watch reads it as history rather than
      // announcing the same returned transfer a second time.
      seen.current?.add(tracking.current);
      tracking.current = null;
      setIncoming(null);
    }
    setFeedError(null);
    setWatchNonce((n) => n + 1);
  };

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
        case "activating":
          // Money in flight, or money already taken and not propagated. Both
          // are a wait; neither is an invitation to pay a second time.
          return activation === "payment" ? (
            <Gate
              tone="warn"
              pending={watching}
              title="Your payment is still on its way"
              body={
                watching
                  ? "Paradigm is waiting for your subscription transfer to land. Your account number appears here once it does — nothing needs paying twice."
                  : "Paradigm is waiting for your subscription transfer to land, and has stopped re-checking on its own. Nothing needs paying twice."
              }
              action="Check now"
              onAction={reload}
            />
          ) : (
            <Gate
              tone="warn"
              pending={watching}
              title="Switching your membership on"
              body={
                watching
                  ? "Your payment is in and the gateway is still opening the naira side. It usually takes a moment, and nothing needs paying again."
                  : "Your payment is in and the gateway has not opened the naira side yet. Paradigm has stopped re-checking on its own — nothing needs paying again."
              }
              action="Check now"
              onAction={reload}
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
            borderColor: "rgba(240,199,90,0.35)",
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

  // Nothing is being asked any more. A `watchStartedAt` of `null` is the moment
  // before the effect arms the watch, and that reads as watching, not as
  // stopped — the first request is already on its way out.
  //
  // Two facts, not one. `onStopped` is the poll saying it gave up, and it says
  // that for a lost session as readily as for the deadline; only elapsed time
  // can attest that the twenty minutes ran out. So the callback decides WHETHER
  // to stop claiming to watch, and the clock decides whether the screen may
  // name the deadline as the reason — telling someone their twenty minutes are
  // up when their session dropped is a false statement in exactly the place
  // invariant 4 cares about.
  //
  // The reason is read at the instant the poll gave up, not at the instant the
  // sentence is rendered: a session lost five minutes in must not turn into
  // "after twenty minutes" simply because the user left the screen open that
  // long. With no callback at all — a phone that slept through the deadline —
  // `now` is the reading, and by then the deadline has genuinely passed.
  const reasonReadAt = stoppedAt ?? now;
  const deadlinePassed =
    watchStartedAt !== null && reasonReadAt - watchStartedAt >= WATCH_ENDS_MS;
  const watchEnded =
    stoppedAt !== null ||
    (watchStartedAt !== null && now - watchStartedAt >= WATCH_ENDS_MS);

  const amountSuffix = incoming?.amount ? ` · ${formatMoney(incoming.amount)}` : "";
  // The stop is stated either way; the deadline is named only when the clock
  // says so. A stop with time left on it — a lost session is the one that
  // reaches this screen — gets the same honest "not watching any more" without
  // a reason invented for it.
  const stoppedTail = deadlinePassed
    ? `after ${WATCH_MINUTES} minutes`
    : "for now";
  const watchLine = rejected
    ? "That transfer was returned rather than credited"
    : watchEnded
      ? detected
        ? `Transfer detected${amountSuffix} — it will still credit, but this screen stopped checking ${stoppedTail}`
        : `Stopped checking ${stoppedTail}. Anything you have already sent still credits — this screen just is not watching for it.`
      : detected
        ? `Transfer detected${amountSuffix} — crediting now`
        : "Watching for your transfer";
  const statusLine = incoming
    ? `STATUS · ${depositStatusLabel(incoming.status).toUpperCase()}`
    : null;
  // A returned transfer keeps its own status line: it is a finished fact, not a
  // claim that something is still being watched for.
  const monoLine =
    watchEnded && !rejected
      ? checkedAgo === null
        ? "NOT CHECKING"
        : `NOT CHECKING · LAST LOOKED ${checkedAgo}S AGO`
      : (statusLine ??
        (checkedAgo === null ? "STANDING BY" : `CHECKED ${checkedAgo}S AGO`));

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
              borderBottomColor: "rgba(227,182,47,0.28)",
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
          {/* The pulse means "a request is going out on a timer". Once the
              watch has run out that is no longer true, so the dot goes with
              it — a dot that keeps beating over a dead poll is the whole
              defect, not a decoration. */}
          {detected ? (
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.up }} />
          ) : rejected || watchEnded ? null : (
            <PulseDot />
          )}
          <Body
            size={13}
            color={rejected ? C.down : watchEnded ? C.sub : detected ? C.up : C.silver}
            style={{ flexShrink: 1, lineHeight: 18 }}
          >
            {watchLine}
          </Body>
        </View>
        <Mono
          size={10}
          color={C.dim}
          style={{ textAlign: "center", marginTop: 8, letterSpacing: 1.2 }}
        >
          {monoLine}
        </Mono>
        {feedError ? (
          <Body size={11.5} color={C.down} style={{ textAlign: "center", marginTop: 10 }}>
            {feedError}
          </Body>
        ) : null}
        {/* Offered whenever the asking has stopped — including after a returned
            transfer, where the poll ends early and the user's next move is
            usually to send another one. */}
        {watchEnded ? (
          <View style={{ marginTop: 14 }}>
            <GhostButton label="Check now" onPress={restartWatch} />
          </View>
        ) : null}
      </View>

      <SectionRule space={20} />

      <GhostButton label="Done" onPress={onDone} />
    </Screen>
  );
}
