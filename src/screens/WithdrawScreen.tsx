import React, { useState } from "react";
import { View, Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  BackHeader,
  MetallicButton,
  GhostButton,
  Label,
  Mono,
  Body,
  Display,
  Keypad,
  Card,
} from "../components/ui";

// Crypto withdraw — pick asset, set destination + amount, sign in the enclave.
type Step = "asset" | "dest" | "confirm" | "sent";

const ASSETS = [
  {
    sym: "ETH",
    name: "Ethereum",
    qty: "0.031",
    avail: "0.031 ETH",
    usd: "$98.10",
    network: "Ethereum mainnet",
    decimals: 3,
    rate: 3164.52,
    maxRaw: "31",
    green: false,
  },
  {
    sym: "SOL",
    name: "Solana",
    qty: "0.62",
    avail: "0.62 SOL",
    usd: "$84.30",
    network: "Solana",
    decimals: 2,
    rate: 135.97,
    maxRaw: "62",
    green: false,
  },
  {
    sym: "USDC",
    name: "USD Coin",
    qty: "130.00 · Base",
    avail: "130.00 USDC",
    usd: "$130.00",
    network: "Base network",
    decimals: 2,
    rate: 1,
    maxRaw: "13000",
    green: true,
  },
];

const DESTINATION = "0x7A3f…88A1";
const TX_HASH = "0x3f9a…c21b";
const FEE_NOTE = "Network fee ≈ $0.12 · sponsored where available";

function formatRaw(raw: string, decimals: number) {
  const padded = raw.padStart(decimals + 1, "0");
  return padded.slice(0, -decimals) + "." + padded.slice(-decimals);
}

export default function WithdrawScreen({
  onBack,
  onDone,
}: {
  onBack?: () => void;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<Step>("asset");
  const [assetIndex, setAssetIndex] = useState(0);
  const [raw, setRaw] = useState("");

  const asset = ASSETS[assetIndex];
  const amount = formatRaw(raw, asset.decimals);
  const usd = (
    (parseInt(raw || "0", 10) / 10 ** asset.decimals) *
    asset.rate
  ).toFixed(2);

  const handleKey = (k: string) => {
    if (k === "del") {
      setRaw(raw.slice(0, -1));
      return;
    }
    if (raw.length >= 9) return;
    setRaw(raw === "" && k === "0" ? raw : raw + k);
  };

  const handleBack = () => {
    if (step === "dest") setStep("asset");
    else if (step === "confirm") setStep("dest");
    else if (onBack) onBack();
  };

  if (step === "sent") {
    return (
      <View
        style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22 }}
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: C.brandGlow,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg width={32} height={32} viewBox="0 0 24 24">
              <Path
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke={C.brand}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          </View>
          <Display size={30} style={{ marginTop: 20 }}>
            Sent
          </Display>
          <Mono size={13} color={C.text} style={{ marginTop: 12 }}>
            {amount} {asset.sym} → {DESTINATION}
          </Mono>
          <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
            {TX_HASH}
          </Mono>
          <Body size={12} color={C.dim} style={{ marginTop: 14 }}>
            Signed in your secure enclave
          </Body>
        </View>
        <View style={{ paddingBottom: 36 }}>
          <MetallicButton label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <BackHeader title="Withdraw" onBack={handleBack} />
      </View>

      {step === "asset" ? (
        <View style={{ paddingHorizontal: 22, marginTop: 22 }}>
          <Label>Choose asset</Label>
          {ASSETS.map((h, i) => (
            <Pressable
              key={h.sym}
              onPress={() => {
                setAssetIndex(i);
                setRaw("");
                setStep("dest");
              }}
              accessibilityRole="button"
              accessibilityLabel={`Withdraw ${h.name}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
                borderBottomWidth: i === ASSETS.length - 1 ? 0 : 1,
                borderBottomColor: C.hairline,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 20,
                  backgroundColor: h.green ? C.upBg : "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mono
                  size={9}
                  color={h.green ? C.up : C.silver}
                  style={{ fontFamily: F.monoSemibold }}
                >
                  {h.sym}
                </Mono>
              </View>
              <View style={{ flex: 1 }}>
                <Body size={13.5} semibold>
                  {h.name}
                </Body>
                <Body size={11} color={C.dim} style={{ marginTop: 2 }}>
                  {h.qty}
                </Body>
              </View>
              <Mono size={13} color={C.text}>
                {h.usd}
              </Mono>
            </Pressable>
          ))}
          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 18 }}
          >
            On-chain sends leave your self-custody wallet directly
          </Body>
        </View>
      ) : null}

      {step === "dest" ? (
        <>
          <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
            <Label>Destination</Label>
            <Card
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
              }}
            >
              <Mono size={13} color={C.text} style={{ flex: 1 }}>
                {DESTINATION}
              </Mono>
              <View style={{ width: 72 }}>
                <GhostButton label="Paste" height={32} />
              </View>
            </Card>
            <Body size={11} color={C.dim} style={{ marginTop: 8 }}>
              {asset.network} · always double-check the chain
            </Body>
          </View>
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Display size={40}>
              {amount}{" "}
              <Display size={22} color={C.dim}>
                {asset.sym}
              </Display>
            </Display>
            <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
              ≈ ${usd} USD
            </Mono>
            <Body size={11} color={C.dim} style={{ marginTop: 8 }}>
              {FEE_NOTE}
            </Body>
          </View>
          <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Body size={11.5} color={C.dim}>
                Available · {asset.avail}
              </Body>
              <Pressable
                onPress={() => setRaw(asset.maxRaw)}
                accessibilityRole="button"
                accessibilityLabel="Withdraw maximum"
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 6,
                  borderRadius: 99,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.card,
                }}
              >
                <Mono
                  size={10.5}
                  color={C.silver}
                  style={{ fontFamily: F.monoSemibold, letterSpacing: 1 }}
                >
                  MAX
                </Mono>
              </Pressable>
            </View>
            <Keypad onKey={handleKey} />
            <View style={{ marginTop: 14 }}>
              <MetallicButton
                label="Review withdrawal"
                onPress={() => {
                  if (raw !== "") setStep("confirm");
                }}
              />
            </View>
          </View>
        </>
      ) : null}

      {step === "confirm" ? (
        <>
          <View
            style={{
              paddingHorizontal: 22,
              marginTop: 26,
              alignItems: "center",
            }}
          >
            <Body size={11.5} color={C.dim}>
              You're withdrawing
            </Body>
            <Display size={44} style={{ marginTop: 6 }}>
              {amount}{" "}
              <Display size={24} color={C.dim}>
                {asset.sym}
              </Display>
            </Display>
            <Mono size={12} color={C.sub} style={{ marginTop: 4 }}>
              ≈ ${usd} USD
            </Mono>
          </View>
          <Card
            style={{
              marginTop: 22,
              marginHorizontal: 20,
              borderRadius: 16,
              paddingVertical: 4,
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: C.hairline,
              }}
            >
              <Body size={12.5} color={C.sub}>
                Asset
              </Body>
              <Mono size={12.5} color={C.text}>
                {asset.name} · {asset.sym}
              </Mono>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: C.hairline,
              }}
            >
              <Body size={12.5} color={C.sub}>
                Destination
              </Body>
              <Mono size={12.5} color={C.text}>
                {DESTINATION}
              </Mono>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 11,
                borderBottomWidth: 1,
                borderBottomColor: C.hairline,
              }}
            >
              <Body size={12.5} color={C.sub}>
                Amount
              </Body>
              <Mono
                size={12.5}
                color={C.text}
                style={{ fontFamily: F.monoSemibold }}
              >
                {amount} {asset.sym}
              </Mono>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 11,
              }}
            >
              <Body size={12.5} color={C.sub}>
                Network fee
              </Body>
              <Mono size={12.5} color={C.text}>
                ≈ $0.12{" "}
                <Mono size={12.5} color={C.dim}>
                  · sponsored
                </Mono>
              </Mono>
            </View>
          </Card>
          <View
            style={{
              marginTop: "auto",
              paddingHorizontal: 22,
              paddingBottom: 36,
            }}
          >
            <Body
              size={11}
              color={C.amber}
              style={{ textAlign: "center", marginBottom: 14 }}
            >
              On-chain transfers can't be reversed.
            </Body>
            <MetallicButton
              label="Sign & send"
              onPress={() => setStep("sent")}
            />
            <View style={{ marginTop: 10 }}>
              <GhostButton
                label="Back to amount"
                onPress={() => setStep("dest")}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
