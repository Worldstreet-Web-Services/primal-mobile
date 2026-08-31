import { Image } from "expo-image";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { CopyMark, useCopy } from "../components/CopyAction";
import { useLinkpayAccount, type AccountPhase } from "../hooks/useLinkpay";
import { accountStatusLabel } from "../lib/gateway/linkpay";
import type { AccountStatus } from "../lib/gateway/types";
import { C, F } from "../theme/tokens";
import {
  BackHeader,
  Body,
  Card,
  Display,
  Label,
  Mono,
  OutlineButton,
  PressableScale,
  Screen,
  SectionRule,
} from "../components/ui";
import { user } from "../data/mock";
import { cn } from "@/lib/cn";

/**
 * Truncate for display only — never for anything a user might copy and send to.
 * Both ends are kept deliberately long: an address poisoner's lookalike differs
 * in the middle, so a stubby head-and-tail is what makes one look legitimate.
 */
function short(address: string | undefined, lead: number): string | null {
  if (!address) return null;
  return address.length <= lead + 8
    ? address
    : `${address.slice(0, lead)}…${address.slice(-6)}`;
}

/**
 * Why the account row has no fallback digits.
 *
 * This card used to print `user.va` / `user.bank` from `src/data/mock` — an
 * invented NUBAN at a bank the member has no account with — as a tap-to-copy
 * row sitting directly above two REAL Decane wallet addresses, drawn in the
 * same type, with the same copy mark. Nothing on screen distinguished the true
 * rows from the fabricated one, which is what makes it worse than a lone lie:
 * the real addresses lent it their credibility. It reads from the gateway now,
 * and says which way it is missing when it is missing.
 */
function accountRowEmpty(
  phase: AccountPhase,
  status: AccountStatus | undefined,
): string {
  switch (phase) {
    case "loading":
      return "Loading…";
    case "signed_out":
      return "Sign in to see it";
    case "unentitled":
      return "With a subscription";
    case "no_account":
      return "Not created yet";
    case "provisioning":
      return "Being opened";
    case "provision_failed":
      return "Could not be opened";
    case "disabled":
      return "Disabled";
    case "unknown_status":
      return accountStatusLabel(status ?? "UNKNOWN");
    case "error":
      return "Couldn't load it";
    default:
      return "Not available";
  }
}

const securityRows = [
  { title: "Transaction PIN", sub: "Required for money-out" },
  { title: "Passkeys", sub: "2 devices · TEE-backed signing" },
  { title: "Trusted devices", sub: "iPhone 16 Pro — this device" },
  { title: "Spend limits", sub: "₦500,000 / day · self-imposed" },
];

/** One labelled value with its own copy affordance. */
function DetailRow({
  label,
  value,
  sub,
  mono = true,
  copyKey,
  copyValue,
  copied,
  onCopy,
  empty = "Not created yet",
  last = false,
}: {
  label: string;
  value: string | null;
  /** Secondary line under the value — the bank, the network. Keeps the
   *  value itself on ONE line, which is what stops a long pairing wrapping. */
  sub?: string;
  mono?: boolean;
  copyKey?: string;
  copyValue?: string;
  copied?: boolean;
  onCopy?: (key: string, value: string) => void;
  /** Stands in for the value when there isn't one. "Not created yet" is right
   *  for a wallet, and wrong for a row that is loading, refused or broken —
   *  each of those is a different fact and the row is where it gets stated. */
  empty?: string;
  last?: boolean;
}) {
  const body = (
    <View
      className="flex-row items-center py-[13px] gap-[12px] border-b-rule"
      style={{
        borderBottomWidth: last ? 0 : 1,
      }}
    >
      <Body className="text-[12px] text-sub">{label}</Body>
      <View className="flex-1 items-end">
        {value ? (
          <>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              className="text-[12.5px] text-text"
              style={{
                fontFamily: mono ? F.mono : F.body,
              }}
            >
              {value}
            </Text>
            {sub ? (
              <Body className="text-[10.5px] text-dim mt-[3px]">{sub}</Body>
            ) : null}
          </>
        ) : (
          <Body className="text-[12px] text-dim">{empty}</Body>
        )}
      </View>
      {value && copyKey ? <CopyMark copied={!!copied} /> : null}
    </View>
  );

  if (!value || !copyKey || !copyValue) return body;
  return (
    <Pressable
      onPress={() => onCopy?.(copyKey, copyValue)}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
    >
      {body}
    </Pressable>
  );
}

// Design 3f: profile — identity, the details worth copying, security, sign out.
export default function ProfileScreen({
  onBack,
  top = 0,
  bottom = 40,
  onSignOut,
  onSwitchAccount,
  signingOut = false,
  addresses,
}: {
  /** Omit on a tab root — without it the header drops its back chevron. */
  onBack?: () => void;
  /** Head space — the route passes the safe-area inset; nothing floats here. */
  top?: number;
  /** Tail space — raise it when something overlays the bottom of the screen. */
  bottom?: number;
  onSignOut?: () => void;
  /**
   * Sign out AND forget this device's app lock, so the next person sets up
   * their own PIN. Deliberately a separate, quieter action: an ordinary sign
   * out keeps the PIN, and someone stepping away from their own phone must not
   * have to re-run onboarding to come back to it.
   */
  onSwitchAccount?: () => void;
  signingOut?: boolean;
  /** Real Decane wallet addresses. Absent until a session exists. */
  addresses?: { evm?: string; solana?: string; tron?: string } | null;
}) {
  const evmShort = short(addresses?.evm, 10);
  const solShort = short(addresses?.solana, 8);
  const [frozen, setFrozen] = useState(false);
  const { copied, copy } = useCopy();

  // The same hook the fiat surface reads. A number is shown only on `ready`,
  // and only if one actually came back — never assembled from anything local.
  const { phase: bankPhase, account } = useLinkpayAccount();
  const accountNumber =
    bankPhase === "ready" ? (account?.accountNumber ?? null) : null;

  const onCopy = (key: string, value: string) => void copy(key, value);

  return (
    <Screen top={top} bottom={bottom}>
      {onBack ? (
        <BackHeader title="Profile" onBack={onBack} />
      ) : (
        <Display className="text-[20px] leading-[21px] pt-[10px]">
          Profile
        </Display>
      )}

      {/* Identity: the person, then how they got here. The avatar carries the
          brand ring so it reads as the same object as the home header's. */}
      <View className="items-center pt-[22px] pb-[4px]">
        <View
          className="w-[84px] h-[84px] rounded-[44px] border-brand-soft p-[3px]"
          style={{
            borderWidth: 1.5,
          }}
        >
          <Image
            source={require("@/assets/images/avatar.png")}
            style={{ width: "100%", height: "100%", borderRadius: 40 }}
            contentFit="cover"
          />
        </View>
        <Display className="text-[22px] leading-[23.1px] mt-[14px]">
          {user.name}
        </Display>
        <Mono className="text-[11px] text-dim mt-[6px] tracking-[1px]">
          {user.tag.toUpperCase()} · VIA KINGSCHAT
        </Mono>
      </View>

      <SectionRule space={22} />

      <Label>Account</Label>
      <Card className="mt-[10px] py-[2px] px-[16px]">
        <DetailRow
          label="Account number"
          value={accountNumber}
          sub={accountNumber ? (account?.bankName ?? undefined) : undefined}
          copyKey="va"
          copyValue={accountNumber?.replace(/\s/g, "")}
          copied={copied === "va"}
          onCopy={onCopy}
          empty={accountRowEmpty(bankPhase, account?.status)}
        />
        <DetailRow
          label="EVM wallet"
          value={evmShort}
          copyKey="evm"
          copyValue={addresses?.evm}
          copied={copied === "evm"}
          onCopy={onCopy}
        />
        <DetailRow
          label="Solana wallet"
          value={solShort}
          copyKey="sol"
          copyValue={addresses?.solana}
          copied={copied === "sol"}
          onCopy={onCopy}
          last
        />
      </Card>
      <Body className="text-[10.5px] text-dim mt-[8px] leading-[16px]">
        Tap any row to copy it in full. Check the whole address before you send
        to it.
      </Body>

      <Label className="mt-[26px]">Security</Label>
      <Card className="mt-[10px] py-[2px] px-[16px]">
        {securityRows.map((r) => (
          <PressableScale key={r.title} scale={0.99}>
            <View className="flex-row items-center gap-[12px] py-[13px] border-b border-b-rule">
              <View className="flex-1">
                <Body className="text-[13.5px]" semibold>
                  {r.title}
                </Body>
                <Body className="text-[10.5px] text-dim mt-[2px]">{r.sub}</Body>
              </View>
              <Body className="text-[15px] text-dim">›</Body>
            </View>
          </PressableScale>
        ))}

        {/* The panic switch. Amber, not brand — this is a warning state the
            user has chosen, not an action we are promoting. */}
        <View className="flex-row items-center gap-[12px] py-[14px]">
          <View className="flex-1">
            <Body className="text-[13.5px]" semibold>
              Freeze money-out
            </Body>
            <Body className="text-[10.5px] text-dim mt-[2px]">
              {frozen
                ? "On — every money-out route is blocked"
                : "Panic switch — blocks every money-out route instantly"}
            </Body>
          </View>
          <Pressable
            onPress={() => setFrozen(!frozen)}
            accessibilityRole="switch"
            accessibilityState={{ checked: frozen }}
            accessibilityLabel="Freeze money-out"
            className={cn(
              "w-[46px] h-[28px] rounded-[15px] border p-[2px] justify-center",
              frozen ? "border-amber" : "border-rule",
            )}
            style={{
              backgroundColor: frozen ? C.amber : C.inset,
              alignItems: frozen ? "flex-end" : "flex-start",
            }}
          >
            <View
              className={cn(
                "w-[22px] h-[22px] rounded-[11px]",
                frozen ? "bg-amber-ink" : "bg-text",
              )}
            />
          </Pressable>
        </View>
      </Card>

      <View className="mt-7">
        <OutlineButton
          label={signingOut ? "Signing out…" : "Sign out"}
          color={C.down}
          height={50}
          onPress={signingOut ? undefined : onSignOut}
        />
        <Text className="mt-3 text-center font-body text-[11.5px] leading-4 text-silver-muted">
          Your PIN stays on this phone — sign back in and you’re straight in.
        </Text>
      </View>

      {onSwitchAccount ? (
        <Pressable
          onPress={signingOut ? undefined : onSwitchAccount}
          accessibilityRole="button"
          accessibilityLabel="Switch account"
          className="mt-4 self-center px-3 py-2"
        >
          <Text className="font-body-medium text-[13px] text-silver underline">
            Switch account
          </Text>
        </Pressable>
      ) : null}

      <Text className="font-mono text-[9.5px] tracking-[1.2px] text-dim text-center mt-[18px]">
        KASHPLUS · KEYS SPLIT THREE WAYS
      </Text>
    </Screen>
  );
}
