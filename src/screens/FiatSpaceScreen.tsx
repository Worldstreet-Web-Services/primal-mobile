import React, { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";

import { CopyMark, useCopy } from "../components/CopyAction";
import {
  AmountText,
  Body,
  Card,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  Pulse,
  PulseDot,
  Screen,
  SectionRule,
  TxRow,
} from "../components/ui";
import type { AccountPhase } from "../hooks/useLinkpay";
import { useFiatOverview } from "../hooks/useLinkpay";
import {
  accountStatusLabel,
  depositStatusLabel,
  maskAccount,
  withdrawalStatusLabel,
  type ActivityEntry,
} from "../lib/gateway/linkpay";
import { formatMoney } from "../lib/gateway/money";
import { isTerminalTransfer } from "../lib/gateway/types";
import { C, withAlpha } from "../theme/tokens";
import { cn } from "@/lib/cn";

// Design 2c: fiat space — its own balance, actions, fiat-only activity. The
// shape is unchanged from the mock build; what changed is that every figure on
// it now comes from the gateway, and the screen has to say so honestly when a
// figure has not arrived, cannot arrive, or is about to.

/* ------------------------------------------------------------------ pieces */

/**
 * The one panel every non-money state renders into: a line about where the
 * user actually is, and at most one thing to do about it.
 */
function StatePanel({
  tone = "quiet",
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
  pending,
}: {
  /** `warn` is the amber "in progress", `bad` the red "this did not work". */
  tone?: "quiet" | "warn" | "bad";
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
  /** Shows the waiting dot beside the title — something is still moving. */
  pending?: boolean;
}) {
  const edge =
    tone === "bad"
      ? withAlpha(C.down, 0.35)
      : tone === "warn"
        ? withAlpha(C.amber, 0.32)
        : C.border;
  const fill =
    tone === "bad"
      ? withAlpha(C.down, 0.08)
      : tone === "warn"
        ? withAlpha(C.amber, 0.07)
        : C.card;

  return (
    <View
      className="mt-[26px] border rounded-[20px] p-[18px]"
      style={{
        backgroundColor: fill,
        borderColor: edge,
      }}
    >
      <View className="flex-row items-center gap-[8px]">
        {pending ? <PulseDot /> : null}
        <Display className="text-[18px] leading-[18.9px]">{title}</Display>
      </View>
      <Body
        size={12.5}

        className={cn(
          "mt-[10px] leading-[19px]",
          tone === "bad" ? "text-down" : "text-sub",
        )}
      >
        {body}
      </Body>
      {action ? (
        <View className="mt-[18px]">
          <MetallicButton
            label={action}
            height={48}
            radius={14}
            size={13.5}
            onPress={onAction}
          />
        </View>
      ) : null}
      {secondary ? (
        <Pressable
          onPress={onSecondary}
          accessibilityRole="button"
          className="mt-[14px] items-center py-[6px]"
        >
          <Body className="text-[12px] text-dim">{secondary}</Body>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The money screen's own shape, held while the figures are still in the air. */
function BalanceSkeleton() {
  return (
    <View className="mt-[26px]">
      <Body className="text-[11.5px] text-dim">Available balance</Body>
      <Pulse width={220} height={40} radius={12} style={{ marginTop: 10 }} />
      <Pulse width={170} height={36} radius={12} style={{ marginTop: 16 }} />
      <View className="mt-[18px] flex-row gap-[10px]">
        <Pulse width="48%" height={46} radius={14} />
        <Pulse width="48%" height={46} radius={14} />
      </View>
      <View className="mt-[26px]">
        <Label>Fiat activity</Label>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="flex-row items-center gap-[12px] py-[14px] border-b-rule"
            style={{
              borderBottomWidth: i === 2 ? 0 : 1,
            }}
          >
            <Pulse width={38} height={38} radius={12} />
            <View className="flex-1 gap-[7px]">
              <Pulse width="58%" height={11} />
              <Pulse width="36%" height={9} />
            </View>
            <Pulse width={72} height={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** One gateway entity → one row. Nothing here computes an amount. */
function ActivityRow({ entry, last }: { entry: ActivityEntry; last: boolean }) {
  if (entry.kind === "deposit") {
    const { deposit } = entry;
    const sub = [deposit.senderBank, deposit.narration ?? deposit.reference]
      .filter(Boolean)
      .join(" · ");
    return (
      <TxRow
        icon="↓"
        dir="in"
        title={deposit.senderName ?? "Bank transfer in"}
        sub={sub || "Deposit"}
        amount={`+${formatMoney(deposit.amount)}`}
        status={depositStatusLabel(deposit.status)}
        credit
        pending={deposit.status === "DETECTED"}
        last={last}
      />
    );
  }

  const { withdrawal } = entry;
  const sub = [withdrawal.bankName, maskAccount(withdrawal.destinationAccount)]
    .filter(Boolean)
    .join(" · ");
  return (
    <TxRow
      icon="↑"
      title={withdrawal.accountName ?? "Bank payout"}
      sub={sub || "Payout"}
      amount={`-${formatMoney(withdrawal.amount)}`}
      status={withdrawalStatusLabel(withdrawal.status)}
      pending={!isTerminalTransfer(withdrawal.status)}
      last={last}
    />
  );
}

/* ------------------------------------------------------------------ screen */

export default function FiatSpaceScreen({
  onAdd,
  onSend,
  onBills,
  onRemit,
  onProvision,
  onNeedsSubscription,
  onNeedsSignIn,
  top = 0,
}: {
  onAdd?: () => void;
  onSend?: () => void;
  /** Airtime, data, power, TV — the VAS surface. */
  onBills?: () => void;
  onRemit?: () => void;
  /** Open the KYC screen — no account yet, or one that stalled part-way. */
  onProvision?: () => void;
  /** The gateway refused on entitlement. The route owns what happens next. */
  onNeedsSubscription?: () => void;
  onNeedsSignIn?: () => void;
  /** Head space for the floating nav header. */
  top?: number;
}) {
  const {
    phase,
    account,
    error,
    activation,
    watching,
    reload,
    balance,
    balanceError,
    activity,
    activityLoading,
    activityError,
  } = useFiatOverview();
  const { copied, copy } = useCopy();

  // The paywall is the route's call, not this screen's — but it has to be told
  // once, and exactly once, or a re-render turns into a navigation loop.
  //
  // `unentitled` and nothing else. A payment that is still in flight, or an
  // entitlement the backend has not finished switching on, is `activating`
  // now: it renders the panel below and re-probes, because pushing a member
  // who has just paid to the paywall is how they end up paying twice.
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

  const footer = (
    <>
      <Body className="text-[11px] text-dim text-center mt-[16px]">
        Balances shown in kobo-true minor units · statements match to the kobo
      </Body>
      <Body className="text-[11px] text-dim text-center mt-[8px]">
        Deposits, transfers and your account number — powered by LinkPay
      </Body>
    </>
  );

  /** The ways this screen is not a money screen, each said plainly. */
  const nonReadyPanel = (current: AccountPhase) => {
    switch (current) {
      case "signed_out":
        return (
          <StatePanel
            title="Sign in to use naira"
            body="Your KashPlus account holds the naira balance. Sign in and it comes back with you."
            action="Sign in"
            onAction={onNeedsSignIn}
          />
        );
      case "unentitled":
        return (
          <StatePanel
            title="Subscription required"
            body="Naira deposits, transfers and your account number are part of a KashPlus subscription. Your sign-in is fine — the subscription is what is missing."
            action="See the plan"
            onAction={onNeedsSubscription}
          />
        );
      case "activating":
        // Two different waits, and the difference is whose money has moved.
        // Neither is a paywall, and neither offers to charge again.
        return activation === "payment" ? (
          <StatePanel
            tone="warn"
            pending={watching}
            title="Your payment is still on its way"
            body={
              watching
                ? "KashPlus has your subscription and is waiting for the transfer to land. Nothing here needs paying twice — this screen is re-checking."
                : "KashPlus has your subscription and is waiting for the transfer to land. It is taking longer than usual — check whenever you want the latest. Nothing here needs paying twice."
            }
            action="Check now"
            onAction={reload}
            secondary="See your payment"
            onSecondary={onNeedsSubscription}
          />
        ) : (
          <StatePanel
            tone="warn"
            pending={watching}
            title="Switching your membership on"
            body={
              watching
                ? "Your payment is in. KashPlus is waiting for the gateway to open the naira side, which usually takes a moment. Nothing needs paying again — this screen is re-checking."
                : "Your payment is in and the gateway has not opened the naira side yet. It is taking longer than usual — check whenever you want the latest. Nothing needs paying again."
            }
            action="Check now"
            onAction={reload}
          />
        );
      case "no_account":
        return (
          <StatePanel
            title="Open your naira account"
            body="A one-time check — your name, phone, email and BVN — opens an account number in your own name. Money sent to it lands in KashPlus."
            action="Start"
            onAction={onProvision}
          />
        );
      case "provisioning":
        return (
          <StatePanel
            tone="warn"
            pending
            title="Opening your account"
            body="Your details are with the bank. This usually takes a minute or two, and this screen is watching for it."
            secondary="Review the details you sent"
            onSecondary={onProvision}
          />
        );
      case "provision_failed":
        return (
          <StatePanel
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
          <StatePanel
            tone="bad"
            title="This account is disabled"
            body="Your naira account has been switched off. Support can say why and turn it back on — nothing in it has moved."
          />
        );
      case "unknown_status":
        return (
          <StatePanel
            tone="warn"
            title={`Account status: ${accountStatusLabel(account?.status ?? "UNKNOWN")}`}
            body="KashPlus does not recognise the state your account is in, so it is not showing you a balance it cannot vouch for. Try again in a moment."
            action="Check again"
            onAction={reload}
          />
        );
      default:
        return (
          <StatePanel
            tone="bad"
            title="Could not load your account"
            body={error ?? "Something went wrong reaching KashPlus."}
            action="Try again"
            onAction={reload}
          />
        );
    }
  };

  if (phase !== "ready") {
    return (
      <Screen top={top}>
        {phase === "loading" ? <BalanceSkeleton /> : nonReadyPanel(phase)}
        {footer}
      </Screen>
    );
  }

  const available = balance?.available;
  const accountNumber = account?.accountNumber;

  return (
    <Screen top={top}>
      {/* Title and back live in the route's NavHeader now. */}
      <View className="mt-[26px]">
        <Body className="text-[11.5px] text-dim">Available balance</Body>
        {/* The skeleton is reserved for a balance still in the air. One that
            arrived without a readable figure gets the em dash and a reason:
            shimmering over it would claim a request is running when the only
            request there was is finished, and it would never resolve. */}
        {available ? (
          <AmountText
            value={formatMoney(available)}
            size={46}
            className="mt-[6px]"
          />
        ) : balanceError || balance ? (
          <>
            <Display className="text-[46px] leading-[48.3px] text-dim mt-[6px]">
              —
            </Display>
            <Body className="text-[11.5px] text-down mt-[8px] leading-[17px]">
              {balanceError ??
                "KashPlus could not read the balance the gateway sent."}
            </Body>
            <Pressable
              onPress={reload}
              accessibilityRole="button"
              className="mt-[12px] self-start"
            >
              <Mono className="text-[10px] text-silver tracking-[1.4px]">
                TRY AGAIN
              </Mono>
            </Pressable>
          </>
        ) : (
          <Pulse
            width={230}
            height={40}
            radius={12}
            style={{ marginTop: 10 }}
          />
        )}

        {balance?.ledger &&
        available &&
        balance.ledger.amountMinor !== available.amountMinor ? (
          <Mono className="text-[12px] text-sub mt-[8px]">
            {formatMoney(balance.ledger)} on the ledger
          </Mono>
        ) : null}

        {accountNumber ? (
          <Pressable
            onPress={() => void copy("account", accountNumber)}
            accessibilityRole="button"
            accessibilityLabel="Copy account number"
          >
            <Card className="mt-[14px] self-start flex-row items-center gap-[9px] py-[9px] px-[13px] rounded-[12px]">
              <Mono className="text-[12.5px]">
                {accountNumber}
                {account?.bankName ? ` · ${account.bankName}` : ""}
              </Mono>
              <CopyMark copied={copied === "account"} />
            </Card>
          </Pressable>
        ) : null}
      </View>

      <View className="mt-[18px] flex-row gap-[10px]">
        <View className="flex-1">
          <MetallicButton
            label="Add"
            height={46}
            radius={14}
            size={13}
            onPress={onAdd}
          />
        </View>
        <View className="flex-1">
          <GhostButton label="Send" onPress={onSend} />
        </View>
        {onBills ? (
          <View className="flex-1">
            <GhostButton label="Bills" onPress={onBills} />
          </View>
        ) : null}
        {/* Cross-border is out of this version (2026-08-16). The prop and the
            screen stay — only the way in is closed — so putting it back is
            re-adding this button, not rebuilding the corridor flow. */}
        {onRemit ? (
          <View className="flex-1">
            <GhostButton label="Remit" onPress={onRemit} />
          </View>
        ) : null}
      </View>

      <View className="mt-[20px]">
        <Label>Fiat activity</Label>
        {activityLoading && activity.length === 0 ? (
          [0, 1, 2].map((i) => (
            <View
              key={i}
              className="flex-row items-center gap-[12px] py-[14px] border-b-rule"
              style={{
                borderBottomWidth: i === 2 ? 0 : 1,
              }}
            >
              <Pulse width={38} height={38} radius={12} />
              <View className="flex-1 gap-[7px]">
                <Pulse width="58%" height={11} />
                <Pulse width="36%" height={9} />
              </View>
              <Pulse width={72} height={12} />
            </View>
          ))
        ) : activityError ? (
          <View className="mt-[14px]">
            <Body className="text-[12.5px] text-down leading-[18px]">
              {activityError}
            </Body>
            <Pressable
              onPress={reload}
              accessibilityRole="button"
              className="mt-[12px] self-start"
            >
              <Mono className="text-[10px] text-silver tracking-[1.4px]">
                TRY AGAIN
              </Mono>
            </Pressable>
          </View>
        ) : activity.length === 0 ? (
          <View className="mt-[8px]">
            <SectionRule space={14} />
            <Display className="text-[15px] leading-[15.75px] text-sub text-center">
              Nothing has moved yet.
            </Display>
            <Body className="text-[12px] text-dim mt-[8px] text-center leading-[18px]">
              {accountNumber
                ? "Send money to the account number above and it will show up here."
                : "Deposits and payouts will show up here."}
            </Body>
          </View>
        ) : (
          activity.map((entry, i) => (
            <ActivityRow
              key={entry.key}
              entry={entry}
              last={i === activity.length - 1}
            />
          ))
        )}
      </View>

      {footer}
    </Screen>
  );
}
