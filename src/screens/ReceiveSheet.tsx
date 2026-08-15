import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { C, F } from "../theme/tokens";
import {
  Display,
  Body,
  Mono,
  Label,
  MetallicButton,
  GhostButton,
  SegTabs,
  Chip,
  PressableScale,
} from "../components/ui";
import { CopyMark, useCopy } from "../components/CopyAction";
import { QrPlate } from "../components/QrPlate";
import { user } from "../data/mock";
import { depositAddresses } from "../lib/crypto/addresses";

// Static per-network-type deposit addresses (PRD §F4) — the auto-convert
// on-ramp, not the embedded wallets. Mock-backed until primal-be serves them.
const NETWORKS = depositAddresses();

/** The bank block as one string — what "share details" actually hands over. */
const bankBlock = () =>
  `${user.name}\n${user.bank}\n${user.va.replace(/ /g, "")}`;

// Designs 4c + 4d: receive sheet — bank VA with copy affordance / crypto network picker.
export default function ReceiveSheet({ onClose }: { onClose?: () => void }) {
  const [tab, setTab] = useState(0);
  const [net, setNet] = useState(0);
  const nw = NETWORKS[net];
  const { copied, copy } = useCopy();

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
          paddingBottom: 42,
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

            <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <MetallicButton
                  label={copied === "va" ? "Copied" : "Copy number"}
                  height={48}
                  radius={14}
                  size={13.5}
                  onPress={() => void copy("va", user.va.replace(/ /g, ""))}
                />
              </View>
              <View style={{ flex: 1 }}>
                <GhostButton
                  label={copied === "block" ? "Copied" : "Copy all details"}
                  height={48}
                  onPress={() => void copy("block", bankBlock())}
                />
              </View>
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

            <View style={{ marginTop: 16 }}>
              <QrPlate value={nw.address} size={126} caption={nw.label} />
            </View>

            <PressableScale
              onPress={() => void copy("addr", nw.address)}
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
                  paddingVertical: 13,
                  paddingHorizontal: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Mono
                  size={12}
                  color={C.silver}
                  style={{ flex: 1, lineHeight: 18 }}
                >
                  {nw.address}
                </Mono>
                <CopyMark copied={copied === "addr"} />
              </View>
            </PressableScale>

            <View style={{ marginTop: 16 }}>
              <MetallicButton
                label={copied === "addr" ? "Copied" : "Copy address"}
                height={48}
                radius={14}
                size={13.5}
                onPress={() => void copy("addr", nw.address)}
              />
            </View>

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
