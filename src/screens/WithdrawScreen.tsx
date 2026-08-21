import React, { useMemo, useState } from "react";
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
} from "../components/ui";
import {
  InstrumentRow,
  MetaChip,
  QuoteCard,
  QuoteRow,
  RowSkeletonList,
  SectionHead,
  Settle,
} from "../components/crypto";
import { NoticeBanner } from "../components/payments";
import { useCryptoPortfolio } from "../hooks/useCryptoPortfolio";
import {
  baseToDisplayFloor,
  displayToBase,
  formatAmount,
} from "../lib/crypto/amounts";
import { type Holding } from "../lib/crypto/balances";
import {
  EVM_CHAIN_ID,
  NETWORK_LABELS,
  TOKEN_CATALOG,
  type NetworkId,
} from "../lib/crypto/catalog";
import { getCryptoWallet } from "../lib/crypto/wallet";

// Crypto withdraw — pick asset, set destination + amount, sign in the enclave.
type Step = "asset" | "dest" | "confirm" | "sent";

interface WithdrawAsset {
  sym: string;
  name: string;
  /** "0.031 ETH" — the row's quantity, and the amount screen's ceiling. */
  avail: string;
  usd: string;
  network: string;
  networkId: NetworkId;
  /** Contract/mint; null = native coin. */
  tokenAddress: string | null;
  tokenDecimals: number;
  /** Keypad granularity — how many decimal places the amount entry offers. */
  decimals: number;
  rate: number;
  /** Balance in display units, floored — the MAX cap. */
  maxRaw: string;
  green: boolean;
}

/** Keypad granularity per symbol (display only — sends stay in base units). */
const DISPLAY_DP: Record<string, number> = {
  ETH: 3,
  SOL: 2,
  POL: 2,
  USDC: 2,
  USDT: 2,
  DAI: 2,
};

function fromHolding(h: Holding): WithdrawAsset {
  const dp = DISPLAY_DP[h.symbol] ?? 3;
  const qty = h.stable ? h.balance.toFixed(2) : formatAmount(h.balance);
  return {
    sym: h.symbol,
    name: h.name,
    avail: `${qty} ${h.symbol}`,
    usd: `$${h.valueUsd.toFixed(2)}`,
    network: NETWORK_LABELS[h.network],
    networkId: h.network,
    tokenAddress: h.address,
    tokenDecimals: h.decimals,
    decimals: dp,
    rate: h.priceUsd,
    maxRaw: baseToDisplayFloor(h.rawBalance, dp, h.decimals),
    green: h.stable,
  };
}

const BASE_USDC = TOKEN_CATALOG.find(
  (t) => t.network === "base-mainnet" && t.symbol === "USDC",
)!.address;

/** Demo figures for when live balances can't load — mirrors src/data/mock.ts. */
const FALLBACK_ASSETS: WithdrawAsset[] = [
  {
    sym: "ETH",
    name: "Ethereum",
    avail: "0.031 ETH",
    usd: "$98.10",
    network: "Ethereum",
    networkId: "eth-mainnet",
    tokenAddress: null,
    tokenDecimals: 18,
    decimals: 3,
    rate: 3164.52,
    maxRaw: "31",
    green: false,
  },
  {
    sym: "SOL",
    name: "Solana",
    avail: "0.62 SOL",
    usd: "$84.30",
    network: "Solana",
    networkId: "solana-mainnet",
    tokenAddress: null,
    tokenDecimals: 9,
    decimals: 2,
    rate: 135.97,
    maxRaw: "62",
    green: false,
  },
  {
    sym: "USDC",
    name: "USD Coin",
    avail: "130.00 USDC",
    usd: "$130.00",
    network: "Base",
    networkId: "base-mainnet",
    tokenAddress: BASE_USDC,
    tokenDecimals: 6,
    decimals: 2,
    rate: 1,
    maxRaw: "13000",
    green: true,
  },
];

/**
 * No fee figure exists to show yet.
 *
 * The wallet seam prices gas when it builds the transaction, and nothing in the
 * app can ask it beforehand — so the chip states the timing instead of a
 * number. The "≈ $0.12 · sponsored" that used to sit here was invented, on the
 * one screen where a user budgets against the figure before committing.
 */
const FEE_NOTE = "Network fee quoted when you sign";

const shorten = (addr: string) => addr.slice(0, 6) + "…" + addr.slice(-4);

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
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);

  const { holdings, loading } = useCryptoPortfolio();
  const live = holdings.length > 0;
  // Chains still answering, nothing to draw yet — skeletons rather than demo
  // figures that would be corrected a beat later.
  const pending = loading && !live;
  const assets = useMemo(
    () => (holdings.length > 0 ? holdings.map(fromHolding) : FALLBACK_ASSETS),
    [holdings],
  );

  // A refresh landing mid-flow may shrink the list; never index past it.
  const asset = assets[Math.min(assetIndex, assets.length - 1)];
  const amount = formatRaw(raw, asset.decimals);
  // Nothing keyed yet. The digits on screen are scaffolding, not a value, and
  // everything downstream of this — colour, the line under the figure, the
  // button — has to say so rather than leave an empty field looking filled.
  const noAmount = raw === "";
  const usd = (
    (parseInt(raw || "0", 10) / 10 ** asset.decimals) *
    asset.rate
  ).toFixed(2);

  // Demo destination: the user's own external-wallet address until the
  // address-book/paste flow lands. Solana assets exit to the Solana address.
  const seamAddresses = getCryptoWallet().getAddresses();
  const destFull =
    asset.networkId === "solana-mainnet"
      ? seamAddresses?.solana
      : seamAddresses?.evm;
  const destination = destFull ? shorten(destFull) : "—";

  const signAndSend = async () => {
    if (sending) return;
    setSendError(null);
    setSending(true);
    try {
      const wallet = getCryptoWallet();
      const amountRaw = displayToBase(raw, asset.decimals, asset.tokenDecimals);
      if (!destFull) throw new Error("No destination wallet yet.");
      if (asset.networkId === "solana-mainnet") {
        const res = await wallet.sendSolana({
          to: destFull,
          mint: asset.tokenAddress,
          amountRaw,
        });
        setTxRef(res.signature);
      } else {
        const res = await wallet.sendEvm({
          chainId: EVM_CHAIN_ID[asset.networkId],
          to: destFull,
          tokenAddress: asset.tokenAddress,
          amountRaw,
        });
        setTxRef(res.hash);
      }
      setStep("sent");
    } catch (e) {
      // The seam refuses until Decane lands — surface it inline, not a crash.
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

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
    else if (step === "confirm") {
      setSendError(null);
      setStep("dest");
    } else if (onBack) onBack();
  };

  if (step === "sent") {
    return (
      <View
        style={{ flex: 1, backgroundColor: C.canvas, paddingHorizontal: 22 }}
      >
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Settle distance={14}>
            <View style={{ alignItems: "center" }}>
              <View
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 37,
                  backgroundColor: C.brandGlow,
                  borderWidth: 1,
                  borderColor: "rgba(227,182,47,0.35)",
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
              <Display size={30} style={{ marginTop: 22 }}>
                Sent
              </Display>
              <Mono size={13.5} color={C.text} style={{ marginTop: 14 }}>
                {amount} {asset.sym} → {destination}
              </Mono>
              {/* The chain's own reference, or nothing. The "0x3f9a…c21b" that
                  stood in here was a hash of no transaction — something a user
                  would paste into an explorer and be told does not exist. */}
              {txRef ? (
                <Mono size={12} color={C.dim} style={{ marginTop: 8 }}>
                  {shorten(txRef)}
                </Mono>
              ) : null}
              <View style={{ marginTop: 18 }}>
                <MetaChip label={`Signed in the enclave · ${asset.network}`} />
              </View>
            </View>
          </Settle>
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
        <View style={{ flex: 1, paddingHorizontal: 22, marginTop: 24 }}>
          <SectionHead
            label="Choose asset"
            right={
              pending ? null : live ? (
                <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.3 }}>
                  {assets.length} {assets.length === 1 ? "ASSET" : "ASSETS"}
                </Mono>
              ) : (
                <MetaChip label="Offline preview" />
              )
            }
          />
          <View style={{ marginTop: 2 }}>
            {pending ? (
              <RowSkeletonList rows={3} />
            ) : (
              assets.map((h, i) => (
                <InstrumentRow
                  key={`${h.networkId}:${h.sym}`}
                  symbol={h.sym}
                  name={h.name}
                  sub={h.avail}
                  value={h.usd}
                  meta={h.network}
                  stable={h.green}
                  last={i === assets.length - 1}
                  accessibilityLabel={`Withdraw ${h.name}`}
                  onPress={() => {
                    setAssetIndex(i);
                    setRaw("");
                    setStep("dest");
                  }}
                />
              ))
            )}
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ alignItems: "center", gap: 11, paddingBottom: 34 }}>
            <Body
              size={11.5}
              color={C.dim}
              style={{ textAlign: "center", lineHeight: 18 }}
            >
              Sends leave your self-custody wallet directly.
            </Body>
            <Label style={{ letterSpacing: 1.6 }}>
              Signed on device · enclave-backed
            </Label>
          </View>
        </View>
      ) : null}

      {step === "dest" ? (
        <>
          <View style={{ paddingHorizontal: 22, marginTop: 20 }}>
            <SectionHead
              label="Destination"
              right={<MetaChip label={asset.network} />}
            />
            <View
              style={{
                marginTop: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                height: 56,
                paddingLeft: 16,
                paddingRight: 10,
                borderRadius: 14,
                backgroundColor: C.raised,
                borderWidth: 1,
                borderColor: C.hairline,
              }}
            >
              <Mono size={13.5} color={C.text} style={{ flex: 1 }}>
                {destination}
              </Mono>
              <View style={{ width: 76 }}>
                <GhostButton label="Paste" height={36} radius={10} />
              </View>
            </View>
            <Body size={11} color={C.dim} style={{ marginTop: 9 }}>
              Double-check the chain — sends can't be recalled.
            </Body>
          </View>
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Display size={40} color={noAmount ? C.placeholder : C.text}>
              {amount}{" "}
              <Display
                size={22}
                color={noAmount ? C.placeholder : C.figureTail}
              >
                {asset.sym}
              </Display>
            </Display>
            {noAmount ? (
              // The sentence carries the meaning, so the ghost digits above are
              // allowed to be decoration. Without it the placeholder would be
              // text nobody could read.
              <Body size={12.5} color={C.sub} style={{ marginTop: 10 }}>
                Enter an amount to withdraw
              </Body>
            ) : (
              <Mono size={12.5} color={C.sub} style={{ marginTop: 10 }}>
                ≈ ${usd} USD
              </Mono>
            )}
            <View style={{ marginTop: 14 }}>
              <MetaChip label={FEE_NOTE} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <Mono size={11.5} color={C.dim}>
                Available · {asset.avail}
              </Mono>
              <Pressable
                onPress={() => setRaw(asset.maxRaw)}
                accessibilityRole="button"
                accessibilityLabel="Withdraw maximum"
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 6,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.inset,
                }}
              >
                <Mono
                  size={10.5}
                  color={C.silver}
                  style={{ fontFamily: F.monoSemibold, letterSpacing: 1.2 }}
                >
                  MAX
                </Mono>
              </Pressable>
            </View>
            <Keypad onKey={handleKey} />
            <View style={{ marginTop: 16 }}>
              {/* A live-looking metal button that silently no-ops on an empty
                  field is the same lie the placeholder colour was telling.
                  Mirrors BuyScreen: the control states what is missing. */}
              {noAmount ? (
                <GhostButton label="Enter an amount" height={52} />
              ) : (
                <MetallicButton
                  label="Review withdrawal"
                  onPress={() => setStep("confirm")}
                />
              )}
            </View>
          </View>
        </>
      ) : null}

      {step === "confirm" ? (
        <>
          <Settle>
            <View
              style={{
                paddingHorizontal: 22,
                marginTop: 28,
                alignItems: "center",
              }}
            >
              <Label>Withdrawing</Label>
              <Display size={44} style={{ marginTop: 10 }}>
                {amount}{" "}
                <Display size={24} color={C.figureTail}>
                  {asset.sym}
                </Display>
              </Display>
              <Mono size={12.5} color={C.sub} style={{ marginTop: 8 }}>
                ≈ ${usd} USD
              </Mono>
            </View>
            <QuoteCard style={{ marginTop: 26, marginHorizontal: 22 }}>
              <QuoteRow
                label="Asset"
                value={`${asset.name} · ${asset.sym}`}
              />
              <QuoteRow label="Network" value={asset.network} />
              <QuoteRow label="Destination" value={destination} />
              <QuoteRow
                label="Amount"
                value={`${amount} ${asset.sym}`}
                strong
              />
              <QuoteRow
                label="Network fee"
                value="—"
                tail="· quoted when you sign"
                last
              />
            </QuoteCard>
          </Settle>
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 40,
            }}
          >
            <Body
              size={11.5}
              color={C.dim}
              style={{ textAlign: "center", lineHeight: 18 }}
            >
              Signed on device, in your secure enclave.{"\n"}Face ID confirms
              every signature.
            </Body>
          </View>
          <View
            style={{
              paddingHorizontal: 22,
              paddingBottom: 36,
            }}
          >
            <NoticeBanner message="On-chain transfers can't be reversed. Check the address and the chain." />
            {sendError ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: C.inset,
                  borderWidth: 1,
                  borderColor: "rgba(246,165,165,0.3)",
                }}
              >
                <Label style={{ color: C.down }}>Not signed</Label>
                <Body
                  size={12}
                  color={C.silver}
                  style={{ marginTop: 6, lineHeight: 17 }}
                >
                  {sendError}
                </Body>
              </View>
            ) : null}
            <View style={{ marginTop: 16 }}>
              <MetallicButton
                label={sending ? "Signing…" : "Sign & send"}
                onPress={signAndSend}
              />
            </View>
            <View style={{ marginTop: 10 }}>
              <GhostButton
                label="Back to amount"
                onPress={() => {
                  setSendError(null);
                  setStep("dest");
                }}
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}
