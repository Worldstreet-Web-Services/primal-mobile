import React from "react";
import { Text, View } from "react-native";

import { CopyField, useCopy } from "../components/CopyAction";
import {
  Body,
  Card,
  Display,
  GhostButton,
  KeyValueList,
  Label,
  MetallicButton,
  Mono,
  PulseDot,
  Screen,
  SectionRule,
  Spinner,
  type KeyValue,
} from "../components/ui";
import { formatMoney, type Money } from "../lib/gateway";
import {
  describeStatus,
  isDelivered,
  isFailure,
  type VasTransaction,
} from "../lib/gateway/services";
import type { TransferStatus } from "../lib/gateway/types";
import { C, F } from "../theme/tokens";
import type { BillDraft } from "./BillsScreen";

/**
 * Where the purchase is, from the screen's point of view.
 *
 * `placing` and `watching` are deliberately separate from the transaction's own
 * status: `placing` means "we have not been told anything yet", which is the
 * only window in which the confirm button must be inert, and `watching` means
 * the gateway has a transaction and we are following it.
 *
 * `checking` is what keeps `placing` honest, and it covers the round trip that
 * decides whether this tap is a retry of a purchase already in the air or a new
 * one. Nothing is being placed during it — nothing has been sent at all — so it
 * may not borrow a word that says money is moving.
 *
 * `stalled` is the one that keeps `watching` honest. A purchase that outlives
 * the poll's clock is still with the provider, but nothing is following it any
 * more — and a live-looking screen over someone's money that nobody is watching
 * is a defect, not a cosmetic one. So the claim is withdrawn and the person is
 * offered the check they would otherwise be waiting for forever.
 */
export type CheckoutPhase =
  | "confirm"
  | "checking"
  | "placing"
  | "watching"
  | "stalled"
  | "settled";

/** Groups of four, for a 20-digit meter token being typed off a screen. */
function prettyToken(token: string): string {
  if (!/^\d{8,}$/.test(token)) return token;
  return token.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

/**
 * `live` is what the dot is actually claiming. It pulses only while something
 * is genuinely following the purchase — a pulse over a watch that has stopped
 * says "we are on it" when nobody is.
 */
function StatusBadge({ status, live }: { status: TransferStatus; live: boolean }) {
  const delivered = isDelivered(status);
  const failed = isFailure(status);
  const tone = delivered ? C.up : failed ? C.down : C.amber;
  const said = describeStatus(status);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {delivered || failed || !live ? (
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: tone,
          }}
        />
      ) : (
        <PulseDot color={tone} />
      )}
      <Body size={13} semibold color={tone}>
        {said.title}
      </Body>
    </View>
  );
}

/**
 * The confirm-and-track half of the bills flow.
 *
 * Presentational, and deliberately the only screen that ever renders a
 * `serviceToken`: an electricity token IS the electricity, so it gets its own
 * surface, its own copy affordance, and no logging anywhere near it.
 */
export default function BillCheckoutScreen({
  top = 0,
  draft,
  phase,
  transaction,
  error,
  sent,
  blocked,
  resumedAt,
  onNeedsSubscription,
  onConfirm,
  onBack,
  onRetry,
  onBuyAnyway,
  onDone,
  onStartOver,
}: {
  top?: number;
  draft: BillDraft;
  phase: CheckoutPhase;
  /** Latest snapshot from the gateway. Null until the purchase is accepted. */
  transaction: VasTransaction | null;
  /** A transport or gateway failure — not a failed purchase. */
  error: string | null;
  /**
   * Whether the purchase had left the client when `error` happened. It changes
   * what trying again MEANS, and the reassurance underneath an error card is
   * only reassuring while it is true: a failure before anything was sent has no
   * "same purchase" to re-send.
   */
  sent: boolean;
  /**
   * The gateway refused this purchase for want of a plan, not a session. It has
   * to be said HERE: the paywall card on the browse screen is unmounted for as
   * long as a checkout is open, so a 403 raised on Pay would otherwise put the
   * person back on an unchanged Confirm with nothing said at all.
   */
  blocked: boolean;
  /**
   * Epoch ms the purchase being shown was originally placed, when this checkout
   * picked up an attempt that was already in the air instead of placing one.
   * Null when this IS the placement; 0 when the clock was not kept.
   */
  resumedAt: number | null;
  onNeedsSubscription: () => void;
  onConfirm: () => void;
  onBack: () => void;
  /**
   * Re-run whatever failed. Before the gateway names a transaction that means
   * re-sending the SAME purchase under the SAME idempotency key; after it, it
   * means picking the status watch back up.
   */
  onRetry: () => void;
  /**
   * Give up on the unfinished purchase being shown and compose a second one.
   * Offered only over a purchase this checkout picked up rather than placed,
   * and only while it is unfinished — the one case where the person in front of
   * the screen is the only one who can say whether they want another.
   */
  onBuyAnyway?: () => void;
  onDone: () => void;
  /** Compose a different purchase — only offered once this one is finished. */
  onStartOver: () => void;
}) {
  const { copied, copy } = useCopy();

  // Hoisted out of the JSX so the copy handler closes over a plain string and
  // never over the transaction — the token has exactly one path to the
  // clipboard and none at all to a log line.
  const token = transaction?.serviceToken ?? null;
  const tokenUnits = transaction?.tokenUnits ?? null;
  const failureReason = transaction?.failureReason ?? null;
  const status: TransferStatus | null = transaction?.status ?? null;
  const delivered = status ? isDelivered(status) : false;
  const failed = status ? isFailure(status) : false;
  // On the wire, in one direction or the other: the whole window in which the
  // confirm button must be inert. `inFlight` is the narrower claim — a purchase
  // actually being placed — and only that one may be worded as paying.
  const inFlight = phase === "placing";
  const busy = phase === "placing" || phase === "checking";
  // The one thing the dot, the heading and the "you can leave" line all have to
  // agree on: whether anything is actually following this purchase right now.
  const watching = phase === "watching";

  // Before the purchase exists there is no fee to state — this catalogue has no
  // quote route — so the fee row says so rather than implying a zero. The
  // moment the gateway answers, both rows switch to what it actually charged.
  const amount: Money = transaction?.amount ?? draft.amount;
  const fee = transaction?.fee ?? null;
  const total = transaction?.totalDebit ?? amount;

  const rows: KeyValue[] = [
    { label: "Biller", value: draft.provider.name },
    ...(draft.product
      ? [{ label: "Plan", value: draft.product.name } satisfies KeyValue]
      : []),
    {
      label: draft.category.destination === "phone" ? "Phone number" : "Pay for",
      value: draft.destinationDisplay,
    },
    ...(transaction?.customerName
      ? [{ label: "Name", value: transaction.customerName } satisfies KeyValue]
      : []),
    ...(transaction?.reference
      ? [{ label: "Reference", value: transaction.reference } satisfies KeyValue]
      : []),
  ];

  const debitRows: KeyValue[] = [
    { label: "Amount", value: formatMoney(amount) },
    {
      label: "Fee",
      value: fee ? formatMoney(fee) : "—",
      valueColor: fee ? C.text : C.dim,
    },
    {
      label: "Total to debit",
      value: formatMoney(total),
      valueColor: C.text,
    },
  ];

  const said = status ? describeStatus(status) : null;

  /**
   * The heading is a claim about what is happening, so `stalled` may not borrow
   * "Paying" — nothing is being done at that point. Delivered and failed still
   * win over the phase: an outcome is an outcome however it was found out.
   */
  const heading =
    phase === "confirm"
      ? "Confirm"
      : delivered
        ? "Done"
        : failed
          ? "Not delivered"
          : phase === "checking"
            ? "Checking"
            : phase === "stalled"
              ? "Still pending"
              : "Paying";

  /**
   * Whether to offer a second, deliberate purchase. Every clause is load
   * bearing: `resumedAt !== null` means this transaction was picked up rather
   * than placed here (offering it over a purchase made seconds ago would invite
   * exactly the double-buy the resume path exists to prevent), and an unfinished
   * status is the only state that can wedge — a delivered or failed one already
   * releases the slot on its own.
   */
  const canBuyAnyway =
    !!onBuyAnyway &&
    resumedAt !== null &&
    !!status &&
    !delivered &&
    !failed &&
    (phase === "watching" || phase === "stalled");

  const placedAt =
    resumedAt !== null && resumedAt > 0
      ? new Date(resumedAt).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <Screen top={top} bottom={56}>
      <View style={{ marginTop: 22 }}>
        <Label>{draft.category.label}</Label>
        <Display size={30} style={{ marginTop: 8 }}>
          {heading}
        </Display>
        {phase === "confirm" ? (
          <Body size={13} color={C.sub} style={{ marginTop: 7, lineHeight: 19 }}>
            Check the number. Airtime and tokens cannot be recalled once the
            provider accepts them.
          </Body>
        ) : null}
      </View>

      <SectionRule space={18} />

      {status ? (
        <View style={{ marginBottom: 16 }}>
          <StatusBadge status={status} live={watching} />
          {said ? (
            <Body size={12.5} color={C.sub} style={{ marginTop: 7, lineHeight: 18 }}>
              {said.detail}
            </Body>
          ) : null}
          {/* Said before anything else about this transaction, because it
              changes what the whole receipt below means: these are the earlier
              purchase's figures, its reference and its token, not a new one's.
              A repeat top-up that quietly showed the morning's token as this
              evening's is exactly what the resume path exists to prevent. */}
          {resumedAt !== null ? (
            <Body size={11.5} color={C.amber} style={{ marginTop: 7, lineHeight: 17 }}>
              {placedAt
                ? `This is the purchase you placed at ${placedAt} — it had not finished, so nothing new was sent.`
                : "This is a purchase you placed earlier — it had not finished, so nothing new was sent."}
            </Body>
          ) : null}
          {watching && !delivered && !failed ? (
            <Body size={11.5} color={C.dim} style={{ marginTop: 6, lineHeight: 17 }}>
              You can leave this screen — the purchase is already placed and
              carries on without it.
            </Body>
          ) : null}
        </View>
      ) : null}

      {/* The watch stopped, the purchase did not. Withdrawing the live claim is
          the whole point of this phase, so it has to say who is doing what now:
          nobody, until the person asks. */}
      {phase === "stalled" ? (
        <Card style={{ marginBottom: 16, padding: 16 }}>
          <Body size={12.5} semibold>
            {transaction?.id ? "Nothing is watching this now" : "Placed, but not trackable"}
          </Body>
          <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
            {transaction?.id
              ? "The purchase is still with the provider — this screen simply stopped following it. Checking asks the gateway where it got to."
              : "The gateway took the purchase but named no transaction to follow, so there is nothing here to track. Sending it again re-sends the same purchase, not a second one."}
          </Body>
        </Card>
      ) : null}

      {/* Two different round trips, and the spinner may only claim the one it
          is over: the first asks what became of the last attempt at this exact
          purchase and sends nothing at all. */}
      {busy && !status ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Spinner />
          <Body size={12.5} color={C.sub}>
            {phase === "checking"
              ? "Checking your last purchase of this — nothing sent yet…"
              : "Placing the purchase…"}
          </Body>
        </View>
      ) : null}

      {/* The token, when there is one. Above the receipt on purpose: it is the
          thing the person came for, and it must not need a scroll. */}
      {token ? (
        <View style={{ marginBottom: 18 }}>
          <Label>Token</Label>
          <View style={{ height: 10 }} />
          <CopyField
            onPress={() => copy("token", token)}
            copied={copied === "token"}
            label="TAP TO COPY"
            accessibilityLabel="Copy token"
          >
            <Text
              selectable
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 19,
                letterSpacing: 1.5,
                color: C.text,
              }}
            >
              {prettyToken(token)}
            </Text>
          </CopyField>
          <Body size={11.5} color={C.dim} style={{ marginTop: 8, lineHeight: 17 }}>
            {tokenUnits
              ? `${tokenUnits}. Type it into the meter exactly, without the spaces.`
              : "Type it into the meter exactly, without the spaces."}
          </Body>
        </View>
      ) : null}

      <KeyValueList rows={rows} />

      <View style={{ height: 12 }} />

      <KeyValueList rows={debitRows} />

      {!fee ? (
        <Body size={11} color={C.dim} style={{ marginTop: 10, lineHeight: 16 }}>
          Paradigm adds nothing to this. If the biller charges a fee it appears
          on this receipt the moment the purchase is placed.
        </Body>
      ) : null}

      {failed && failureReason ? (
        <Card
          style={{
            marginTop: 16,
            padding: 16,
            borderColor: "rgba(246,165,165,0.35)",
          }}
        >
          <Body size={12.5} color={C.down} semibold>
            {status === "REVERSED" ? "Reversed" : "The provider declined it"}
          </Body>
          <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
            {failureReason}
          </Body>
        </Card>
      ) : null}

      {/* A refusal for want of a plan is not a failure of this purchase, so it
          gets the paywall's words and the paywall's way out rather than the
          generic "could not place it" — and it takes precedence over the error
          card so the two never say the same thing twice. */}
      {blocked ? (
        <Card style={{ marginTop: 16, padding: 16 }}>
          <Body size={12.5} semibold>
            Your plan has lapsed
          </Body>
          <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
            {error ??
              "Bills need an active Paradigm plan. Your sign-in is fine — only the plan has lapsed."}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 8, lineHeight: 17 }}>
            Nothing was taken. Renew, and this same purchase can be sent
            unchanged.
          </Body>
          <View style={{ height: 14 }} />
          <GhostButton label="See plans" onPress={onNeedsSubscription} />
        </Card>
      ) : error ? (
        <Card style={{ marginTop: 16, padding: 16 }}>
          <Body size={12.5} semibold>
            {transaction ? "Lost track of it" : "Could not place it"}
          </Body>
          <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
            {error}
          </Body>
          {/* Three different true sentences, because there are three different
              failures here and they do not mean the same thing. The first
              clause is the transaction ID rather than the transaction, because
              that is exactly what the retry branches on: without one there is
              nothing to follow and trying again re-sends. */}
          <Body size={11.5} color={C.dim} style={{ marginTop: 8, lineHeight: 17 }}>
            {transaction?.id
              ? "Trying again picks the tracking back up. Nothing is sent a second time."
              : sent
                ? "Trying again re-sends the same purchase, not a second one."
                : "Nothing was sent — the check that runs before placing it is what failed."}
          </Body>
        </Card>
      ) : null}

      <View style={{ height: 26 }} />

      {/* One button, and it is inert for the whole round trip. A second tap
          would be a second purchase in every system that does not have the key
          — and here it would be a wasted request either way. */}
      {phase === "confirm" || phase === "checking" || phase === "placing" ? (
        <>
          <MetallicButton
            label={
              phase === "checking"
                ? "Checking"
                : inFlight
                  ? "Paying"
                  : `Pay ${formatMoney(total)}`
            }
            onPress={onConfirm}
            loading={busy}
            disabled={busy}
          />
          <View style={{ height: 10 }} />
          <GhostButton label="Back" onPress={onBack} disabled={busy} />
        </>
      ) : null}

      {phase === "watching" && error ? (
        <>
          <MetallicButton label="Try again" onPress={onRetry} />
          <View style={{ height: 10 }} />
          <GhostButton label="Close" onPress={onDone} />
        </>
      ) : null}

      {phase === "watching" && !error ? (
        <GhostButton label="Close" onPress={onDone} />
      ) : null}

      {/* `stalled` had no buttons at all, which made the one phase that admits
          nobody is watching the one phase with no way to start watching again. */}
      {phase === "stalled" ? (
        <>
          <MetallicButton
            label={transaction?.id ? "Check again" : "Send it again"}
            onPress={onRetry}
          />
          <View style={{ height: 10 }} />
          <GhostButton label="Close" onPress={onDone} />
        </>
      ) : null}

      {/* The way out of a purchase that never finishes.
          Resuming an unfinished attempt is what stops a retry becoming a second
          charge, but a transaction that never reaches a terminal status — stuck
          at the provider, or wearing a status this build has never heard of —
          would otherwise make this number and this amount unbuyable for good.
          Offered only over a purchase picked up from an earlier visit, never
          over the one just placed, and worded as what it is: a second purchase,
          not a retry of the one above. */}
      {canBuyAnyway ? (
        <>
          <View style={{ height: 10 }} />
          <GhostButton label="Buy it again anyway" onPress={onBuyAnyway} />
          <Body size={11} color={C.dim} style={{ marginTop: 10, lineHeight: 16 }}>
            That one has not finished. Buying again places a second, separate
            purchase — the one above carries on at the provider, and if it lands
            you will have paid for both.
          </Body>
        </>
      ) : null}

      {phase === "settled" ? (
        <>
          <MetallicButton label="Done" onPress={onDone} />
          <View style={{ height: 10 }} />
          <GhostButton label="Pay something else" onPress={onStartOver} />
        </>
      ) : null}

      {transaction?.id ? (
        <Mono size={10} color={C.dim} style={{ marginTop: 18, textAlign: "center" }}>
          {transaction.id}
        </Mono>
      ) : null}
    </Screen>
  );
}
