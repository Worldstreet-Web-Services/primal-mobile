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
import { STATIC_PRICES_USD } from "../lib/crypto/prices";
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
        <View className="mt-[26px]">
          <View className="flex-row items-center gap-[10px]">
            <Label>Wallet value</Label>
            {pending ? (
              <MetaChip label="Reading chains" tone="live" pulse />
            ) : live ? null : (
              <MetaChip label="Offline preview" />
            )}
          </View>
          {pending ? (
            <View className="mt-[12px] gap-[13px]">
              <PulseBlock width={214} height={40} radius={10} />
              <PulseBlock width={128} height={12} />
            </View>
          ) : (
            <>
              {/* The dollar figure and nothing under it.

                  There was a "≈ ₦…" line here, set in the same quiet money
                  register as a balance, computed as `total * USD_NGN` — a real
                  on-chain figure multiplied by a hand-typed constant whose own
                  comment called it "static demo FX". Nothing on screen
                  distinguished the read number above from the invented one
                  below, and at roughly ₦1.5m per $1,000 a stale rate is wrong
                  by an amount that matters.

                  There is no FX endpoint anywhere in the gateway contract —
                  `/v1/auth/*`, `/v1/linkpay/*` and `/v1/subscriptions/*` are
                  the whole surface and none of them quotes a rate. So this
                  follows the rule the home card was just built on: show what
                  was actually read, and decline to convert rather than convert
                  with a number nobody stands behind. If a naira equivalent is
                  wanted here, it needs a quoted, dated rate from the gateway
                  first. */}
              <Display className="text-[46px] leading-[48.3px] mt-[8px]">
                ${Number(whole).toLocaleString("en-US")}
                <Display className="text-[26px] leading-[27.3px] text-figure-tail">
                  .{cents}
                </Display>
              </Display>
            </>
          )}
        </View>
      </Settle>

      <View className="mt-[22px] flex-row gap-[10px]">
        <View className="flex-1">
          <MetallicButton
            label="Buy"
            height={48}
            radius={14}
            size={13.5}
            onPress={onBuy}
          />
        </View>
        <View className="flex-1">
          <GhostButton
            label="Deposit"
            height={48}
            radius={14}
            onPress={onDeposit}
          />
        </View>
        <View className="flex-1">
          <GhostButton
            label="Withdraw"
            height={48}
            radius={14}
            onPress={onWithdraw}
          />
        </View>
      </View>

      <View className="mt-[26px]">
        <SectionHead
          label="Holdings"
          right={
            pending ? null : (
              <Mono className="text-[9.5px] text-dim tracking-[1.3px]">
                {rows.length} {rows.length === 1 ? "ASSET" : "ASSETS"}
              </Mono>
            )
          }
        />
        <View className="mt-[2px]">
          {pending ? (
            <RowSkeletonList rows={3} />
          ) : rows.length === 0 ? (
            // A real, empty wallet — say so rather than leaving a void.
            <View className="py-[26px] items-center">
              <Body className="text-[13px] text-sub">No assets yet</Body>
              <Body className="text-[11.5px] text-dim mt-[5px] text-center">
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

      <Card className="mt-[18px] flex-row items-center gap-[14px] p-[15px] rounded-[18px]">
        <View className="flex-1">
          <Body className="text-[12.5px]" semibold>
            Auto-convert deposits to ₦
          </Body>
          <Body className="text-[10.5px] text-dim mt-[3px]">
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
              <View className="w-[22px] h-[22px] rounded-[11px] bg-ink" />
            </LinearGradient>
          ) : (
            <View className="w-[46px] h-[28px] rounded-[14px] p-[3px] bg-canvas-inset border border-rule">
              <View className="w-[20px] h-[20px] rounded-[10px] bg-sub" />
            </View>
          )}
        </PressableScale>
      </Card>

      <View className="mt-[26px] pt-[20px] border-t border-t-rule items-center gap-[12px]">
        <Body className="text-[11.5px] text-dim text-center leading-[18px]">
          Keys split three ways — device · Decane · recovery.{"\n"}High-value
          sends re-confirm with Face ID, per signature.
        </Body>
        <Label className="tracking-[1.6px]">
          Every chain, one address · LinkPay
        </Label>
      </View>
    </Screen>
  );
}
