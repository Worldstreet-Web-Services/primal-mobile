import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { View } from "react-native";
import {
  InstrumentRow,
  MetaChip,
  PulseBlock,
  RowSkeletonList,
  SectionHead,
  Settle,
} from "../components/crypto";
import {
  Body,
  Card,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  PressableScale,
  Screen,
} from "../components/ui";
import { holdings as mockHoldings } from "../data/mock";
import { useCryptoPortfolio } from "../hooks/useCryptoPortfolio";
import { holdingQtyLabel } from "../lib/crypto/balances";
import { STATIC_PRICES_USD, USD_NGN } from "../lib/crypto/prices";
import { C } from "../theme/tokens";

/** The mock's demo total — shown whenever live balances aren't on screen. */
const FALLBACK_TOTAL_USD = 312.4;

interface Row {
  key: string;
  sym: string;
  name: string;
  qty: string;
  usd: string;
  /** Unit price, so the right column reads value over what one costs. */
  price?: number;
  stable?: boolean;
}

/** Sub-dollar assets need their working digits; everything else takes cents. */
const unitPrice = (p: number) =>
  `$${p.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: p < 1 ? 4 : 2,
  })}`;

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
  const { holdings, totalUsd, loading, error } = useCryptoPortfolio();

  // Live rows whenever the store answered, INCLUDING an answer of "nothing" —
  // a funded wallet and an empty one are both real. Only a failed read (the
  // store's own error flag: no addresses, or every chain unreachable) falls
  // back to the tagged mock figures. Keying this off `holdings.length` instead
  // made a brand-new wallet look permanently offline.
  const live = !error;
  // Nothing to show yet and the chains are still answering — the figures are
  // skeletons rather than a stand-in total that would only be corrected later.
  // Skeletons only while there is genuinely nothing to draw yet — `live` is
  // true from the first frame now, so it can't gate this any more.
  const pending = loading && holdings.length === 0 && !error;
  const rows: Row[] = live
    ? holdings.map((h) => ({
        key: `${h.network}:${h.symbol}`,
        sym: h.symbol,
        name: h.name,
        qty: holdingQtyLabel(h),
        usd: `$${h.valueUsd.toFixed(2)}`,
        price: h.priceUsd,
        stable: h.stable,
      }))
    : mockHoldings.map((h) => ({
        key: h.sym,
        sym: h.sym,
        name: h.name,
        qty: h.qty,
        usd: h.usd,
        price: STATIC_PRICES_USD[h.sym],
        stable: "green" in h ? h.green : false,
      }));
  const total = live ? totalUsd : FALLBACK_TOTAL_USD;
  const [whole, cents] = total.toFixed(2).split(".");

  return (
    <Screen top={top}>
      <Settle>
        <View style={{ marginTop: 26 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Label>Wallet value</Label>
            {pending ? (
              <MetaChip label="Reading chains" tone="live" pulse />
            ) : live ? null : (
              <MetaChip label="Offline preview" />
            )}
          </View>
          {pending ? (
            <View style={{ marginTop: 12, gap: 13 }}>
              <PulseBlock width={214} height={40} radius={10} />
              <PulseBlock width={128} height={12} />
            </View>
          ) : (
            <>
              <Display size={46} style={{ marginTop: 8 }}>
                ${Number(whole).toLocaleString("en-US")}
                <Display size={26} color={C.dim}>
                  .{cents}
                </Display>
              </Display>
              <Mono size={12.5} color={C.sub} style={{ marginTop: 9 }}>
                ≈ ₦{Math.round(total * USD_NGN).toLocaleString("en-US")}
              </Mono>
            </>
          )}
        </View>
      </Settle>

      <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <MetallicButton
            label="Buy"
            height={48}
            radius={14}
            size={13.5}
            onPress={onBuy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton
            label="Deposit"
            height={48}
            radius={14}
            onPress={onDeposit}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton
            label="Withdraw"
            height={48}
            radius={14}
            onPress={onWithdraw}
          />
        </View>
      </View>

      <View style={{ marginTop: 26 }}>
        <SectionHead
          label="Holdings"
          right={
            pending ? null : (
              <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.3 }}>
                {rows.length} {rows.length === 1 ? "ASSET" : "ASSETS"}
              </Mono>
            )
          }
        />
        <View style={{ marginTop: 2 }}>
          {pending ? (
            <RowSkeletonList rows={3} />
          ) : rows.length === 0 ? (
            // A real, empty wallet — say so rather than leaving a void.
            <View style={{ paddingVertical: 26, alignItems: "center" }}>
              <Body size={13} color={C.sub}>
                No assets yet
              </Body>
              <Body
                size={11.5}
                color={C.dim}
                style={{ marginTop: 5, textAlign: "center" }}
              >
                Deposit or buy, and it lands here.
              </Body>
            </View>
          ) : (
            rows.map((h, i) => (
              <InstrumentRow
                key={h.key}
                symbol={h.sym}
                name={h.name}
                sub={h.qty}
                value={h.usd}
                meta={h.price ? `@ ${unitPrice(h.price)}` : undefined}
                stable={h.stable}
                last={i === rows.length - 1}
              />
            ))
          )}
        </View>
      </View>

      <Card
        style={{
          marginTop: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 15,
          borderRadius: 18,
        }}
      >
        <View style={{ flex: 1 }}>
          <Body size={12.5} semibold>
            Auto-convert deposits to ₦
          </Body>
          <Body size={10.5} color={C.dim} style={{ marginTop: 3 }}>
            Incoming crypto settles into your fiat balance.
          </Body>
        </View>
        <PressableScale
          onPress={() => setAutoConvert(!autoConvert)}
          scale={0.94}
          accessibilityLabel="Auto-convert deposits to naira"
        >
          {autoConvert ? (
            <LinearGradient
              colors={C.metal}
              style={{
                width: 46,
                height: 28,
                borderRadius: 14,
                padding: 3,
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
                width: 46,
                height: 28,
                borderRadius: 14,
                padding: 3,
                backgroundColor: C.inset,
                borderWidth: 1,
                borderColor: C.hairline,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: C.sub,
                }}
              />
            </View>
          )}
        </PressableScale>
      </Card>

      <View
        style={{
          marginTop: 26,
          paddingTop: 20,
          borderTopWidth: 1,
          borderTopColor: C.hairline,
          alignItems: "center",
          gap: 12,
        }}
      >
        <Body
          size={11.5}
          color={C.dim}
          style={{ textAlign: "center", lineHeight: 18 }}
        >
          Keys split three ways — device · Decane · recovery.{"\n"}High-value
          sends re-confirm with Face ID, per signature.
        </Body>
        <Label style={{ letterSpacing: 1.6 }}>
          Every chain, one address · LinkPay
        </Label>
      </View>
    </Screen>
  );
}
