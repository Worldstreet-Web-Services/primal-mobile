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
 */
export type CheckoutPhase = "confirm" | "placing" | "watching" | "settled";

/** Groups of four, for a 20-digit meter token being typed off a screen. */
function prettyToken(token: string): string {
  if (!/^\d{8,}$/.test(token)) return token;
  return token.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function StatusBadge({ status }: { status: TransferStatus }) {
  const delivered = isDelivered(status);
  const failed = isFailure(status);
  const tone = delivered ? C.up : failed ? C.down : C.amber;
  const said = describeStatus(status);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {delivered || failed ? (
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
  onConfirm,
  onBack,
  onRetry,
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
  onConfirm: () => void;
  onBack: () => void;
  /**
   * Re-run whatever failed. Before the gateway names a transaction that means
   * re-sending the SAME purchase under the SAME idempotency key; after it, it
   * means picking the status watch back up.
   */
  onRetry: () => void;
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
  const inFlight = phase === "placing";

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

  return (
    <Screen top={top} bottom={56}>
      <View style={{ marginTop: 22 }}>
        <Label>{draft.category.label}</Label>
        <Display size={30} style={{ marginTop: 8 }}>
          {phase === "confirm" ? "Confirm" : delivered ? "Done" : failed ? "Not delivered" : "Paying"}
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
          <StatusBadge status={status} />
          {said ? (
            <Body size={12.5} color={C.sub} style={{ marginTop: 7, lineHeight: 18 }}>
              {said.detail}
            </Body>
          ) : null}
          {phase === "watching" && !delivered && !failed ? (
            <Body size={11.5} color={C.dim} style={{ marginTop: 6, lineHeight: 17 }}>
              You can leave this screen — the purchase is already placed and
              carries on without it.
            </Body>
          ) : null}
        </View>
      ) : null}

      {inFlight && !status ? (
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
            Placing the purchase…
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

      {error ? (
        <Card style={{ marginTop: 16, padding: 16 }}>
          <Body size={12.5} semibold>
            {transaction ? "Lost track of it" : "Could not place it"}
          </Body>
          <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
            {error}
          </Body>
          <Body size={11.5} color={C.dim} style={{ marginTop: 8, lineHeight: 17 }}>
            Trying again re-sends the same purchase, not a second one.
          </Body>
        </Card>
      ) : null}

      <View style={{ height: 26 }} />

      {/* One button, and it is inert for the whole round trip. A second tap
          would be a second purchase in every system that does not have the key
          — and here it would be a wasted request either way. */}
      {phase === "confirm" || phase === "placing" ? (
        <>
          <MetallicButton
            label={inFlight ? "Paying" : `Pay ${formatMoney(total)}`}
            onPress={onConfirm}
            loading={inFlight}
            disabled={inFlight}
          />
          <View style={{ height: 10 }} />
          <GhostButton label="Back" onPress={onBack} disabled={inFlight} />
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
