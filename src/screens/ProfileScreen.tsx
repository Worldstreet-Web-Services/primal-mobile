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
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 13,
        gap: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <Body size={12} color={C.sub}>
        {label}
      </Body>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        {value ? (
          <>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={{
                fontFamily: mono ? F.mono : F.body,
                fontSize: 12.5,
                color: C.text,
              }}
            >
              {value}
            </Text>
            {sub ? (
              <Body size={10.5} color={C.dim} style={{ marginTop: 3 }}>
                {sub}
              </Body>
            ) : null}
          </>
        ) : (
          <Body size={12} color={C.dim}>
            {empty}
          </Body>
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
        <Display size={20} style={{ paddingTop: 10 }}>
          Profile
        </Display>
      )}

      {/* Identity: the person, then how they got here. The avatar carries the
          brand ring so it reads as the same object as the home header's. */}
      <View
        style={{
          alignItems: "center",
          paddingTop: 22,
          paddingBottom: 4,
        }}
      >
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 44,
            borderWidth: 1.5,
            borderColor: C.brandSoft,
            padding: 3,
          }}
        >
          <Image
            source={require("@/assets/images/avatar.png")}
            style={{ width: "100%", height: "100%", borderRadius: 40 }}
            contentFit="cover"
          />
        </View>
        <Display size={22} style={{ marginTop: 14 }}>
          {user.name}
        </Display>
        <Mono size={11} color={C.dim} style={{ marginTop: 6, letterSpacing: 1 }}>
          {user.tag.toUpperCase()} · VIA KINGSCHAT
        </Mono>
      </View>

      <SectionRule space={22} />

      <Label>Account</Label>
      <Card style={{ marginTop: 10, paddingVertical: 2, paddingHorizontal: 16 }}>
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
      <Body size={10.5} color={C.dim} style={{ marginTop: 8, lineHeight: 16 }}>
        Tap any row to copy it in full. Check the whole address before you send
        to it.
      </Body>

      <Label style={{ marginTop: 26 }}>Security</Label>
      <Card style={{ marginTop: 10, paddingVertical: 2, paddingHorizontal: 16 }}>
        {securityRows.map((r) => (
          <PressableScale key={r.title} scale={0.99}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 13,
                borderBottomWidth: 1,
                borderBottomColor: C.hairline,
              }}
            >
              <View style={{ flex: 1 }}>
                <Body size={13.5} semibold>
                  {r.title}
                </Body>
                <Body size={10.5} color={C.dim} style={{ marginTop: 2 }}>
                  {r.sub}
                </Body>
              </View>
              <Body size={15} color={C.dim}>
                ›
              </Body>
            </View>
          </PressableScale>
        ))}

        {/* The panic switch. Amber, not brand — this is a warning state the
            user has chosen, not an action we are promoting. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Body size={13.5} semibold>
              Freeze money-out
            </Body>
            <Body size={10.5} color={C.dim} style={{ marginTop: 2 }}>
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
            style={{
              width: 46,
              height: 28,
              borderRadius: 15,
              backgroundColor: frozen ? C.amber : "rgba(255,255,255,0.16)",
              borderWidth: 1,
              borderColor: frozen ? C.amber : C.hairline,
              padding: 2,
              alignItems: frozen ? "flex-end" : "flex-start",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: frozen ? C.ink : C.text,
              }}
            />
          </Pressable>
        </View>
      </Card>

      <View style={{ marginTop: 28 }}>
        <OutlineButton
          label={signingOut ? "Signing out…" : "Sign out"}
          color={C.down}
          height={50}
          onPress={signingOut ? undefined : onSignOut}
        />
      </View>

      <Text
        style={{
          fontFamily: F.mono,
          fontSize: 9.5,
          letterSpacing: 1.2,
          color: C.dim,
          textAlign: "center",
          marginTop: 18,
        }}
      >
        PARADIGM · KEYS SPLIT THREE WAYS
      </Text>
    </Screen>
  );
}
