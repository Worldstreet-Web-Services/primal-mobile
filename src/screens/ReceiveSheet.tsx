import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F } from "../theme/tokens";
import {
  Display,
  Body,
  Mono,
  Label,
  GhostButton,
  SegTabs,
  Chip,
  PressableScale,
} from "../components/ui";
import { CopyMark, useCopy } from "../components/CopyAction";
import { QrPlate } from "../components/QrPlate";
import { user } from "../data/mock";
import { usingMockAuth } from "../lib/auth/decane";
import { depositAddresses } from "../lib/crypto/addresses";

// Static per-network-type deposit addresses (PRD §F4) — the auto-convert
// on-ramp, not the embedded wallets. Mock-backed until primal-be serves them.
const NETWORKS = depositAddresses();

/** The bank block as one string — what "share details" actually hands over. */
const bankBlock = () =>
  `${user.name}\n${user.bank}\n${user.va.replace(/ /g, "")}`;

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
  return (
    <View
      style={{ flex: 1, backgroundColor: C.canvas, justifyContent: "flex-end" }}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View
        style={{
          backgroundColor: C.sheet,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: "rgba(199,204,209,0.16)",
          paddingTop: 12,
          paddingHorizontal: 22,
          paddingBottom: Math.max(insets.bottom, 16) + 26,
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 3,
            backgroundColor: "rgba(199,204,209,0.3)",
            alignSelf: "center",
            marginBottom: 16,
          }}
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Display size={21}>Receive</Display>
            <Body size={11.5} color={C.dim} style={{ marginTop: 3 }}>
              Hand this to anyone. It lands as naira.
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
              backgroundColor: "#1A1D22",
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
          <View>
            <View style={{ marginTop: 20 }}>
              <QrPlate
                value={bankBlock()}
                size={132}
                caption={user.bank}
              />
            </View>

            {/* The number is the crown jewel on this sheet too — it gets the
                plate, and the bank and holder sit under it as provenance. */}
            <PressableScale
              onPress={() => void copy("va", user.va.replace(/ /g, ""))}
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
                  borderColor: copied === "va" ? "rgba(124,231,176,0.4)" : C.border,
                  borderRadius: 20,
                  paddingVertical: 16,
                }}
              >
                <Label>Account number</Label>
                <Mono
                  size={25}
                  color={C.text}
                  style={{
                    fontFamily: F.monoSemibold,
                    letterSpacing: 3,
                    marginTop: 8,
                  }}
                >
                  {user.va}
                </Mono>
                <Body size={12} color={C.sub} style={{ marginTop: 8 }}>
                  {user.bank} · {user.name}
                </Body>
                <View style={{ marginTop: 12 }}>
                  <CopyMark copied={copied === "va"} label="TAP TO COPY" />
                </View>
              </View>
            </PressableScale>

            {/* The plate above already copies the number on tap, so the only
                button left is the one it cannot do: hand over the whole block
                — name, bank and number — in one paste. */}
            <View style={{ marginTop: 14 }}>
              <GhostButton
                label={
                  copied === "block" ? "Copied" : "Copy name, bank and number"
                }
                height={48}
                onPress={() => void copy("block", bankBlock())}
              />
            </View>

            <Body
              size={11}
              color={C.dim}
              style={{ textAlign: "center", marginTop: 14, lineHeight: 17.5 }}
            >
              Anyone can transfer to this number.{"\n"}It settles as your
              Paradigm balance, usually under 10s.
            </Body>
          </View>
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
            <Body size={11} color={C.dim} style={{ marginTop: 10, lineHeight: 16 }}>
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
                      copied === "addr" ? "rgba(124,231,176,0.4)" : C.border,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Mono
                    size={12}
                    color={C.text}
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
                size={12.5}
                color={C.dim}
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
                <Text style={{ color: C.up, fontSize: 12 }}>↓</Text>
                <Body size={11.5} color={C.up} semibold>
                  Converts to naira on arrival
                </Body>
              </View>
              <Body
                size={11}
                color={C.dim}
                style={{ textAlign: "center", marginTop: 8, lineHeight: 17 }}
              >
                Credited the moment conversion clears, ahead of settlement. A
                failed conversion refunds on-chain and shows in Activity.
              </Body>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
