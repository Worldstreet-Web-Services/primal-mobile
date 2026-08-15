import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  Body,
  Card,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  Screen,
} from "../components/ui";
import { holdings } from "../data/mock";
import { C, F } from "../theme/tokens";

// Design 2d: crypto space — per-chain balances + auto-convert toggle.
export default function CryptoSpaceScreen({
  onDeposit,
  onWithdraw,
  onBuy,
  top = 0,
}: {
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onBuy?: () => void;
  /** Head space for the floating nav header. */
  top?: number;
}) {
  const [autoConvert, setAutoConvert] = useState(true);
  return (
    <Screen top={top}>
      <View style={{ marginTop: 26 }}>
        <Body size={11.5} color={C.dim}>
          Wallet value
        </Body>
        <Display size={46} style={{ marginTop: 6 }}>
          $312
          <Display size={26} color={C.dim}>
            .40
          </Display>
        </Display>
        <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
          ≈ ₦480,100 · ETH + SOL wallets, TEE-signed
        </Mono>
      </View>
      <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <MetallicButton
            label="Buy"
            height={46}
            radius={14}
            size={13}
            onPress={onBuy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton label="Deposit" onPress={onDeposit} />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton label="Withdraw" onPress={onWithdraw} />
        </View>
      </View>
      <View style={{ marginTop: 20 }}>
        <Label>Holdings</Label>
        {holdings.map((h, i) => (
          <View
            key={h.sym}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 13,
              borderBottomWidth: i === holdings.length - 1 ? 0 : 1,
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
          </View>
        ))}
      </View>
      <Card
        style={{
          marginTop: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          padding: 13,
        }}
      >
        <View style={{ flex: 1 }}>
          <Body size={12.5} semibold>
            Auto-convert deposits to ₦
          </Body>
          <Body size={10.5} color={C.dim} style={{ marginTop: 2 }}>
            Incoming crypto fills your fiat balance instantly
          </Body>
        </View>
        <Pressable onPress={() => setAutoConvert(!autoConvert)}>
          {autoConvert ? (
            <LinearGradient
              colors={C.metal}
              style={{
                width: 44,
                height: 26,
                borderRadius: 14,
                padding: 2,
                alignItems: "flex-end",
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: C.ink,
                }}
              />
            </LinearGradient>
          ) : (
            <View
              style={{
                width: 44,
                height: 26,
                borderRadius: 14,
                padding: 2,
                backgroundColor: "rgba(255,255,255,0.2)",
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: C.text,
                }}
              />
            </View>
          )}
        </Pressable>
      </Card>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 18, lineHeight: 17 }}
      >
        Keys split three ways — device · Decane · recovery.{"\n"}High-value
        sends re-confirm with Face ID per signature.
      </Body>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 12 }}
      >
        Every chain, one address — powered by LinkPay
      </Body>
    </Screen>
  );
}
