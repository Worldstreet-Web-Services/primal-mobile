import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F, withAlpha } from "../theme/tokens";
import {
  Display,
  Body,
  Mono,
  Label,
  GhostButton,
  Pulse,
  SegTabs,
  Chip,
  PressableScale,
} from "../components/ui";
import { CopyMark, useCopy } from "../components/CopyAction";
import { QrPlate } from "../components/QrPlate";
import { useLinkpayAccount, type AccountPhase } from "../hooks/useLinkpay";
import { usingMockAuth } from "../lib/auth/decane";
import {
  accountStatusLabel,
  type LinkpayAccount,
} from "../lib/gateway/linkpay";
import { depositAddresses } from "../lib/crypto/addresses";

// Static per-network-type deposit addresses (PRD §F4) — the auto-convert
// on-ramp, not the embedded wallets. Mock-backed until the gateway serves them.
const NETWORKS = depositAddresses();

/**
 * Why this sheet no longer prints a NUBAN of its own.
 *
 * The bank tab used to read `user` from `src/data/mock` and hand out
 * `9012 883 774 · Rubies MFB · Dave Kadiri` as the member's OWN naira account —
 * on a plate, inside a scannable QR, under the caption "Anyone can transfer to
 * this number", with TAP TO COPY under it. Every one of those affordances is
 * built to be given to a third party, so the fabrication did not stay on the
 * member's screen: it wired a stranger's real money to whoever holds that
 * number. It is the same defect the crypto half of this sheet already refuses
 * to ship, and it gets the same answer — the real account or nothing at all.
 */

/**
 * The one thing this sheet is allowed to hand over on the bank tab.
 *
 * Built only from what the gateway returned. `null` when there is no number,
 * which is what suppresses the QR and the copy affordances below — there is no
 * partial version of this block worth sharing.
 */
function bankBlockFor(account: LinkpayAccount | null): string | null {
  const number = account?.accountNumber?.replace(/\s/g, "");
  if (!number) return null;
  return [account?.accountName, account?.bankName, number]
    .filter((line): line is string => !!line)
    .join("\n");
}

/**
 * Why the bank tab has no number to show, said in the voice the crypto half
 * already uses. Never a guess, never a placeholder digit.
 */
function bankNotice(
  phase: AccountPhase,
  account: LinkpayAccount | null,
  error: string | null,
): string {
  switch (phase) {
    case "signed_out":
      return "Sign in to see your naira account number.";
    case "unentitled":
      return "Your naira account number comes with a KashPlus subscription.";
    case "no_account":
      return "No naira account yet — open one and the number appears here.";
    case "provisioning":
      return "The bank is still opening your account. The number appears here as soon as there is one.";
    case "provision_failed":
      return (
        account?.failureReason ??
        "That account could not be opened, so there is no number to hand out."
      );
    case "disabled":
      return "This account is disabled — a transfer into it would be returned, so the number is not shown.";
    case "unknown_status":
      return `Account status: ${accountStatusLabel(
        account?.status ?? "UNKNOWN",
      )}. KashPlus will not hand out a number it cannot vouch for.`;
    case "error":
      return error ?? "Could not load your account details.";
    default:
      // Includes a `ready` account the gateway sent with no number on it.
      return "No account number to show yet.";
  }
}

// Designs 4c + 4d: receive sheet — bank VA with copy affordance / crypto network picker.
export default function ReceiveSheet({
  onClose,
  addresses,
}: {
  onClose?: () => void;
  /** Real Decane wallet addresses, keyed to the network tabs below. */
  addresses?: { evm?: string; solana?: string; tron?: string } | null;
}) {
  const [tab, setTab] = useState(0);
  const [net, setNet] = useState(0);
  const { copied, copy } = useCopy();
  // The same hook FiatSpaceScreen and FundBankScreen read. There is exactly one
  // account number in this app and it comes from here.
  const { phase: bankPhase, account, error: bankError } = useLinkpayAccount();
  // Bottom-anchored, so the sheet owns its own home-indicator clearance —
  // the route mounts it bare rather than inside a SafeAreaView.
  const insets = useSafeAreaInsets();

  // Keyed by the catalog's `kind`; bitcoin has no Decane wallet, so it stays
  // undefined and falls through to the empty state below.
  //
  // Mock-auth sessions carry placeholder addresses (0xMOCK / MOCKsol / TMOCK).
  // Those are exactly what the rule below forbids — a QR of one is money sent
  // to an account nobody holds the key to — so an unconfigured build shows the
  // empty state rather than its own placeholders.
  const live: Record<string, string | undefined> = usingMockAuth
    ? {}
    : {
        evm: addresses?.evm,
        solana: addresses?.solana,
        tron: addresses?.tron,
      };

  // Show the real address or nothing. A mock deposit address is money sent to
  // an account nobody holds the key to, so it must never reach this screen —
  // which is also why the QR below only renders once `addr` exists.
  const base = NETWORKS[net];
  const nw = { ...base, addr: live[base.kind] ?? null };

  // Same rule as `nw.addr` one line up: the block exists only when the gateway
  // gave us a real number, and everything shareable below is gated on it.
  const bankShare = bankPhase === "ready" ? bankBlockFor(account) : null;
  const accountNumber = account?.accountNumber ?? "";
  // Provenance the gateway actually sent. Empty is a real possibility, and an
  // empty provenance line is why the block button below is conditional: with
  // nothing but the number in it, "copy name, bank and number" is a promise the
  // clipboard would not keep.
  const bankProvenance = [account?.bankName, account?.accountName].filter(
    (part): part is string => !!part,
  );

  return (
    <View className="flex-1 bg-canvas justify-end">
      <Pressable
        className="flex-1"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View
        className="bg-sheet border-t border-border pt-[12px] px-[22px]"
        style={{
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingBottom: Math.max(insets.bottom, 16) + 26,
        }}
      >
        <View className="w-[36px] h-[4px] rounded-[3px] bg-border-strong self-center mb-[16px]" />
        <View className="flex-row items-center justify-between">
          <View>
            <Display className="text-[21px] leading-[22.05px]">Receive</Display>
            <Body className="text-[11.5px] text-dim mt-[3px]">
              {tab === 0
                ? "Hand this to anyone. It lands as naira."
                : "Your wallet addresses. What lands stays crypto."}
            </Body>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 16,
              // Sheets now sit *below* the ground, so this puck's old near-black
              // fill landed within a point of C.sheet and the ✕ floated on
              // nothing. Inset lifts it back into a pressable target.
              backgroundColor: C.inset,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: C.sub, fontSize: 14 }}>✕</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 16 }}>
          <SegTabs
            tabs={["Bank transfer", "Crypto"]}
            active={tab}
            onChange={setTab}
          />
        </View>

        {tab === 0 ? (
          bankShare ? (
            <View>
              <View style={{ marginTop: 20 }}>
                <QrPlate
                  value={bankShare}
                  size={132}
                  caption={account?.bankName ?? "Naira account"}
                />
              </View>

              {/* The number is the crown jewel on this sheet too — it gets the
                  plate, and the bank and holder sit under it as provenance. */}
              <PressableScale
                onPress={() =>
                  void copy("va", accountNumber.replace(/\s/g, ""))
                }
                scale={0.985}
              >
                <View
                  accessibilityRole="button"
                  accessibilityLabel="Copy account number"
                  style={{
                    marginTop: 18,
                    alignItems: "center",
                    backgroundColor: C.raised,
                    borderWidth: 1,
                    borderColor:
                      copied === "va" ? withAlpha(C.up, 0.4) : C.border,
                    borderRadius: 20,
                    paddingVertical: 16,
                  }}
                >
                  <Label>Account number</Label>
                  <Mono
                    className="text-[25px] text-text"

                    style={{
                      fontFamily: F.monoSemibold,
                      letterSpacing: 3,
                      marginTop: 8,
                    }}
                  >
                    {accountNumber}
                  </Mono>
                  {/* Provenance, and only what came back. A bank with no name
                      on it prints no line rather than a stray separator. */}
                  {bankProvenance.length ? (
                    <Body
                      className="text-[12px] text-sub"
                      style={{ marginTop: 8 }}
                    >
                      {bankProvenance.join(" · ")}
                    </Body>
                  ) : null}
                  <View style={{ marginTop: 12 }}>
                    <CopyMark copied={copied === "va"} label="TAP TO COPY" />
                  </View>
                </View>
              </PressableScale>

              {/* The plate above already copies the number on tap, so the only
                  button left is the one it cannot do: hand over the whole block
                  — name, bank and number — in one paste. */}
              {bankProvenance.length ? (
                <View style={{ marginTop: 14 }}>
                  <GhostButton
                    label={
                      copied === "block"
                        ? "Copied"
                        : "Copy name, bank and number"
                    }
                    height={48}
                    onPress={() => void copy("block", bankShare)}
                  />
                </View>
              ) : null}

              <Body
                className="text-[11px] text-dim"

                style={{ textAlign: "center", marginTop: 14, lineHeight: 17.5 }}
              >
                Anyone can transfer to this number.{"\n"}It credits to your
                KashPlus balance once the provider confirms it.
              </Body>
            </View>
          ) : bankPhase === "loading" ? (
            // A skeleton, not a placeholder number. Nothing here is copyable
            // and nothing is encoded into a QR while the answer is still out.
            <View style={{ marginTop: 20, alignItems: "center", gap: 14 }}>
              <Pulse width={132} height={132} radius={22} />
              <Pulse height={78} radius={20} />
              <Pulse width="60%" height={12} />
            </View>
          ) : (
            <View style={{ marginTop: 24, paddingBottom: 6 }}>
              <Body
                className="text-[12.5px] text-dim"

                style={{
                  textAlign: "center",
                  maxWidth: 300,
                  alignSelf: "center",
                  lineHeight: 19,
                }}
              >
                {bankNotice(bankPhase, account, bankError)}
              </Body>
            </View>
          )
        ) : (
          <View>
            <View
              style={{
                marginTop: 16,
                flexDirection: "row",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {NETWORKS.map((n, i) => (
                <Chip
                  key={n.kind}
                  label={n.label}
                  active={i === net}
                  tone="brand"
                  onPress={() => setNet(i)}
                />
              ))}
            </View>
            <Body
              className="text-[11px] text-dim"
              style={{ marginTop: 10, lineHeight: 16 }}
            >
              {nw.note}
            </Body>

            {nw.addr ? (
              <View style={{ marginTop: 16 }}>
                <QrPlate value={nw.addr} size={126} caption={nw.label} />
              </View>
            ) : null}
            {nw.addr ? (
              <PressableScale
                onPress={() => void copy("addr", nw.addr as string)}
                scale={0.985}
              >
                <View
                  accessibilityRole="button"
                  accessibilityLabel="Copy deposit address"
                  style={{
                    marginTop: 16,
                    backgroundColor: C.card,
                    borderWidth: 1,
                    borderColor:
                      copied === "addr" ? withAlpha(C.up, 0.4) : C.border,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Mono
                    className="text-[12px] text-text"

                    style={{
                      flex: 1,
                      lineHeight: 18,
                      fontFamily: F.monoSemibold,
                    }}
                  >
                    {nw.addr}
                  </Mono>
                  <CopyMark copied={copied === "addr"} label="COPY" />
                </View>
              </PressableScale>
            ) : (
              <Body
                className="text-[12.5px] text-dim"

                style={{
                  textAlign: "center",
                  marginTop: 16,
                  maxWidth: 280,
                  alignSelf: "center",
                  lineHeight: 19,
                }}
              >
                No {nw.label} address yet — sign in to create your wallet.
              </Body>
            )}
            <View
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: C.hairline,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                }}
              >
                <Text style={{ color: C.silver, fontSize: 12 }}>◇</Text>
                <Body className="text-[11.5px] text-silver" semibold>
                  Arrives as crypto, in your custody
                </Body>
              </View>
              {/* This is the DECANE WALLET address, not an auto-convert
                  deposit address. Those are minted per user/chain by the
                  provider (PRD §F4 — Liquifia static addresses, the same
                  shape as Ark's ensureStaticAddress) and are what the
                  optimistic fill credits against. Until the gateway serves
                  them, promising naira here would be a lie: anything sent
                  to this address stays crypto. */}
              <Body className="text-[11px] text-dim text-center mt-[8px] leading-[17px]">
                Auto-convert to naira arrives with your deposit address — for
                now this is your wallet, and what lands stays crypto.
              </Body>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
