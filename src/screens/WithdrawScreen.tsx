import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { isAddress } from "viem";
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
import { CopyMark, useCopy } from "../components/CopyAction";
import { NoticeBanner } from "../components/payments";
import { usePinPrompt } from "../components/PinPrompt";
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
  type NetworkId,
} from "../lib/crypto/catalog";
import { getCryptoWallet } from "../lib/crypto/wallet";
import { directWithdrawalBlock } from "../lib/crypto/withdraw";
import { addressEdges, addressGroups } from "../lib/gateway/subscription";

// Crypto withdraw — pick asset, paste/type the destination, set the amount,
// PIN, sign in the enclave. Every figure on this screen is a chain read or a
// user entry; the demo asset list and the auto-filled "destination" (the
// user's own address, standing in for a field that did not exist) are gone.
type Step = "asset" | "dest" | "amount" | "confirm" | "sent";

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
  /** Exact base-unit balance — the BigInt ceiling every entry checks against. */
  rawBalance: string;
  stable: boolean;
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
    rawBalance: h.rawBalance,
    stable: h.stable,
  };
}

/**
 * No fee figure exists to show yet.
 *
 * The wallet seam prices gas when it builds the transaction, and nothing in the
 * app can ask it beforehand — so the chip states the timing instead of a
 * number. The "≈ $0.12 · sponsored" that used to sit here was invented, on the
 * one screen where a user budgets against the figure before committing.
 */
const FEE_NOTE = "Requires native network gas";

/** Base58, the strict alphabet — no 0, O, I or l. Solana keys land in 32–44. */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_SHAPE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Why an address is not usable, or null when it is. Every rejection names the
 * reason — a field that silently refuses teaches the user to retype the same
 * mistake harder.
 */
function destinationProblem(asset: WithdrawAsset, dest: string): string | null {
  const addr = dest.trim();
  if (addr === "") return "Enter or paste a destination address.";

  if (asset.networkId === "solana-mainnet") {
    if (addr.startsWith("0x"))
      return "That is an Ethereum-side address — this send leaves on Solana.";
    if (!SOLANA_ADDRESS.test(addr))
      return "A Solana address is 32–44 base58 characters — no 0, O, I or l.";
    return null;
  }

  if (SOLANA_ADDRESS.test(addr) && !addr.startsWith("0x"))
    return `That looks like a Solana address — this send leaves on ${asset.network}.`;
  if (!EVM_SHAPE.test(addr))
    return `An ${asset.network} address is 0x plus 40 hex characters.`;
  // Shape is right; viem's strict check catches a mixed-case string whose
  // checksum doesn't hold — i.e. at least one character is wrong.
  if (!isAddress(addr))
    return "That address fails its checksum — at least one character is mistyped.";
  if (
    asset.tokenAddress &&
    addr.toLowerCase() === asset.tokenAddress.toLowerCase()
  )
    return "That is the token's own contract, not a wallet — funds sent there are unrecoverable.";
  return null;
}

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
  /**
   * A snapshot taken when the row is tapped, not an index into the live list —
   * a portfolio refresh landing mid-flow can reorder or shrink the list, and a
   * send must not quietly retarget a different asset because row 2 moved.
   */
  const [asset, setAsset] = useState<WithdrawAsset | null>(null);
  const [dest, setDest] = useState("");
  const [destError, setDestError] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [txRef, setTxRef] = useState<string | null>(null);

  const { holdings, gasNetworks, loading, error, complete, pricesLive, refresh } =
    useCryptoPortfolio();
  const pinPrompt = usePinPrompt();
  const { copied, copy } = useCopy();

  /*
   * The asset list's states, worst news first. `walletless` is asked of the
   * seam rather than the store because the store flags "no addresses" and
   * "chains unreachable" with the same `error` bit, and the two need different
   * sentences — one is fixed by signing in, the other by retrying. The demo
   * assets that used to stand in behind an "Offline preview" chip are gone:
   * a list of things you cannot actually send is not a preview, it is a prop.
   */
  const walletless = getCryptoWallet().getAddresses() === null;
  const failed = !walletless && error;
  const pending = !walletless && !failed && loading && holdings.length === 0;
  const withdrawalRows = holdings.map((holding) => ({
    holding,
    block: directWithdrawalBlock(holding, gasNetworks),
  }));
  const assets = withdrawalRows
    .filter((row) => row.block === null)
    .map((row) => fromHolding(row.holding));
  const solanaBlocked = withdrawalRows.some((row) => row.block === "solana");
  const gasBlocked = withdrawalRows.some((row) => row.block === "needs_gas");
  const unavailableNotice = [
    solanaBlocked ? "Solana sends are hidden until signing and broadcast are wired." : null,
    gasBlocked
      ? "Token sends without native gas on the same network are hidden; sponsorship is not connected yet."
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" ");

  const paste = async () => {
    const s = (await Clipboard.getStringAsync()).trim();
    if (!s) {
      setDestError("Nothing on the clipboard.");
      return;
    }
    setDest(s);
    setDestError(null);
  };

  const signAndSend = async () => {
    if (sending || !asset) return;
    setSendError(null);
    setSending(true);
    try {
      // The transaction PIN is the wallet PIN — the prompt verifies the four
      // digits against the stored hash. The keypad this replaces accepted any
      // four digits and called it confirmation.
      await pinPrompt.request("Confirm this withdrawal");
      const wallet = getCryptoWallet();
      const amountRaw = displayToBase(raw, asset.decimals, asset.tokenDecimals);
      const to = dest.trim();
      let reference: string;
      if (asset.networkId === "solana-mainnet") {
        const res = await wallet.sendSolana({
          to,
          mint: asset.tokenAddress,
          amountRaw,
        });
        reference = res.signature;
      } else {
        const res = await wallet.sendEvm({
          chainId: EVM_CHAIN_ID[asset.networkId],
          to,
          tokenAddress: asset.tokenAddress,
          amountRaw,
        });
        reference = res.hash;
      }
      // No success without a reference — structural, not assumed. A wallet
      // resolving with an empty hash is a wallet that has not proven a send,
      // and "sent" without proof is the exact screen this flow must never show.
      if (!reference) {
        throw new Error(
          "The wallet reported no transaction reference. The send may not have gone out — check your history before retrying.",
        );
      }
      setTxRef(reference);
      setStep("sent");
      // The hash proves broadcast, not settlement. Refresh now for fast chains,
      // and the Done action refreshes once more after the receipt has had time
      // to propagate to the balance RPCs.
      void refresh();
    } catch (e) {
      // Changing your mind at the PIN is a decision, not a failure — the sheet
      // closes and the confirm screen simply stands as it was.
      if (e instanceof Error && e.message === "PIN entry cancelled") return;
      // The sender's own words when it has them — "Solana withdrawals aren't
      // wired yet", a gas failure, a refusal from the enclave — inline, where
      // the user decided to send, not a crash or a generic shrug.
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
    else if (step === "amount") setStep("dest");
    else if (step === "confirm") {
      setSendError(null);
      setStep("amount");
    } else if (onBack) onBack();
  };

  /* -------------------------------------------------------------- sent */

  if (step === "sent" && asset) {
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
                Submitted
              </Display>
              <Mono size={13.5} color={C.text} style={{ marginTop: 14 }}>
                {formatRaw(raw, asset.decimals)} {asset.sym}
              </Mono>
              <View style={{ marginTop: 18 }}>
                <MetaChip label={`Signed in the enclave · ${asset.network}`} />
              </View>
            </View>
          </Settle>

          {/* The chain's own reference — what the wallet actually returned,
              whole and copyable, so it can be pasted into an explorer. The
              "0x3f9a…c21b" that once stood in here was a hash of no
              transaction. */}
          {txRef ? (
            <View style={{ alignSelf: "stretch", marginTop: 30 }}>
              <Label>Transaction reference</Label>
              <Pressable
                onPress={() => void copy("tx", txRef)}
                accessibilityRole="button"
                accessibilityLabel="Copy transaction reference"
                style={{
                  marginTop: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  backgroundColor: C.raised,
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                }}
              >
                <Mono
                  size={12}
                  color={C.text}
                  style={{ flex: 1, lineHeight: 19 }}
                >
                  {addressGroups(txRef).join(" ")}
                </Mono>
                <CopyMark copied={copied === "tx"} label="COPY" />
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={{ paddingBottom: 36 }}>
          <MetallicButton
            label="Done"
            onPress={() => {
              void refresh();
              onDone?.();
            }}
          />
        </View>
      </View>
    );
  }

  /* ------------------------------------------------------ shared shell */

  const amount = asset ? formatRaw(raw, asset.decimals) : "";
  // Nothing keyed yet, or a keyed zero — either way there is no amount, and
  // everything downstream (colour, the line under the figure, the button)
  // says so rather than leaving an empty field looking filled.
  const noAmount = raw === "" || BigInt(raw || "0") === 0n;
  // BigInt on base units — the one comparison that decides whether the send
  // is even possible must not ride on display floats.
  const overMax =
    asset != null &&
    displayToBase(raw || "0", asset.decimals, asset.tokenDecimals) >
      BigInt(asset.rawBalance);
  const usd = asset
    ? ((parseInt(raw || "0", 10) / 10 ** asset.decimals) * asset.rate).toFixed(
        2,
      )
    : "0.00";

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <BackHeader title="Withdraw" onBack={handleBack} />
      </View>

      {/* -------------------------------------------------------- asset */}

      {step === "asset" ? (
        <View style={{ flex: 1, paddingHorizontal: 22, marginTop: 24 }}>
          <SectionHead
            label="Choose asset"
            right={
              pending || walletless || failed ? null : !complete ? (
                // A count implies the list is whole; on a partial read it
                // isn't, so the corner says that instead of a number.
                <MetaChip label="Partial read" tone="warn" />
              ) : assets.length > 0 ? (
                <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.3 }}>
                  {assets.length} {assets.length === 1 ? "ASSET" : "ASSETS"}
                </Mono>
              ) : null
            }
          />
          <View style={{ marginTop: 2 }}>
            {walletless ? (
              <View style={{ paddingVertical: 24 }}>
                <Body size={13} color={C.sub} style={{ lineHeight: 20 }}>
                  Withdrawals sign in your own wallet, and there is no wallet
                  on this session. Sign in first — then everything you hold is
                  sendable from here.
                </Body>
              </View>
            ) : failed ? (
              <View style={{ paddingVertical: 24 }}>
                <Body size={13} color={C.sub} style={{ lineHeight: 20 }}>
                  Paradigm could not read your wallets on-chain, so it does
                  not know what you can send.
                </Body>
                <View style={{ marginTop: 14, alignSelf: "flex-start" }}>
                  <GhostButton
                    label="Try again"
                    height={40}
                    radius={12}
                    onPress={() => void refresh()}
                    style={{ paddingHorizontal: 22 }}
                  />
                </View>
              </View>
            ) : pending ? (
              <RowSkeletonList rows={3} />
            ) : assets.length === 0 ? (
              <View style={{ paddingVertical: 26, alignItems: "center" }}>
                <Body size={13} color={C.sub}>
                  {unavailableNotice
                    ? "No asset is ready to send"
                    : complete
                      ? "Nothing to withdraw"
                      : "Nothing read yet"}
                </Body>
                <Body
                  size={11.5}
                  color={C.dim}
                  style={{ marginTop: 5, textAlign: "center", lineHeight: 17 }}
                >
                  {unavailableNotice ||
                    (complete
                      ? "This wallet holds no assets Paradigm can see. Deposit first, and it shows up here."
                      : "The chains that answered show nothing, and some didn't answer.")}
                </Body>
                {complete ? null : (
                  <View style={{ marginTop: 14 }}>
                    <GhostButton
                      label="Read again"
                      height={38}
                      radius={12}
                      onPress={() => void refresh()}
                      style={{ paddingHorizontal: 22 }}
                    />
                  </View>
                )}
              </View>
            ) : (
              <>
                {assets.map((h, i) => (
                  <InstrumentRow
                    key={`${h.networkId}:${h.sym}`}
                    symbol={h.sym}
                    name={h.name}
                    sub={h.avail}
                    value={h.usd}
                    meta={h.network}
                    stable={h.stable}
                    last={i === assets.length - 1}
                    accessibilityLabel={`Withdraw ${h.name}`}
                    onPress={() => {
                      setAsset(h);
                      setDest("");
                      setDestError(null);
                      setRaw("");
                      setSendError(null);
                      setStep("dest");
                    }}
                  />
                ))}
                {complete ? null : (
                  <Body
                    size={11.5}
                    color={C.sub}
                    style={{ marginTop: 12, lineHeight: 17 }}
                  >
                    Some chains didn't answer — assets held on them aren't
                    listed here yet.
                  </Body>
                )}
                {unavailableNotice ? (
                  <View style={{ marginTop: 14 }}>
                    <NoticeBanner message={unavailableNotice} />
                  </View>
                ) : null}
              </>
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

      {/* --------------------------------------------------------- dest */}

      {step === "dest" && asset ? (
        <View style={{ flex: 1, paddingHorizontal: 22, marginTop: 20 }}>
          <SectionHead
            label={`Send ${asset.sym} to`}
            right={<MetaChip label={asset.network} />}
          />
          <View
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 56,
              paddingLeft: 16,
              paddingRight: 10,
              borderRadius: 14,
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: destError ? "rgba(246,165,165,0.45)" : C.hairline,
            }}
          >
            <TextInput
              value={dest}
              onChangeText={(t) => {
                setDest(t);
                if (destError) setDestError(null);
              }}
              placeholder={
                asset.networkId === "solana-mainnet"
                  ? "Solana address"
                  : "0x…"
              }
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              accessibilityLabel="Destination address"
              style={{
                flex: 1,
                minHeight: 54,
                color: C.text,
                fontFamily: F.mono,
                fontSize: 13,
              }}
            />
            <View style={{ width: 76 }}>
              <GhostButton
                label="Paste"
                height={36}
                radius={10}
                onPress={() => void paste()}
              />
            </View>
          </View>
          {destError ? (
            // The reason, next to the field that earned it — never a silent
            // refusal, which teaches people to retype the same mistake harder.
            <Body size={12} color={C.down} style={{ marginTop: 9, lineHeight: 17 }}>
              {destError}
            </Body>
          ) : (
            <Body size={11} color={C.dim} style={{ marginTop: 9, lineHeight: 16 }}>
              {`An address on ${asset.network} — sends can't be recalled, so it is checked before anything moves.`}
            </Body>
          )}
          <View style={{ marginTop: 18 }}>
            {dest.trim() === "" ? (
              <GhostButton label="Enter an address" height={52} />
            ) : (
              <MetallicButton
                label="Continue"
                onPress={() => {
                  const problem = destinationProblem(asset, dest);
                  if (problem) {
                    setDestError(problem);
                    return;
                  }
                  setDestError(null);
                  setStep("amount");
                }}
              />
            )}
          </View>
        </View>
      ) : null}

      {/* ------------------------------------------------------- amount */}

      {step === "amount" && asset ? (
        <>
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
            ) : overMax ? (
              <Body size={12.5} color={C.down} style={{ marginTop: 10 }}>
                More than you hold — {asset.avail} is the ceiling
              </Body>
            ) : (
              <Mono size={12.5} color={C.sub} style={{ marginTop: 10 }}>
                ≈ ${usd} USD{pricesLive ? "" : " · snapshot price"}
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
              {asset.tokenAddress === null ? (
                // Sending the full native balance guarantees failure because
                // the fee is paid in this same asset. Until a preflight quote
                // computes an exact spendable max, do not offer a lying MAX.
                <Mono size={10.5} color={C.dim}>
                  LEAVE SOME FOR GAS
                </Mono>
              ) : (
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
              )}
            </View>
            <Keypad onKey={handleKey} />
            <View style={{ marginTop: 16 }}>
              {/* A live-looking metal button that silently no-ops is the same
                  lie the placeholder colour was telling — the control states
                  what is missing, or what is wrong. */}
              {noAmount ? (
                <GhostButton label="Enter an amount" height={52} />
              ) : overMax ? (
                <GhostButton label="More than you hold" height={52} />
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

      {/* ------------------------------------------------------ confirm */}

      {step === "confirm" && asset
        ? (() => {
            // Recomputed at render, not stored — the string being verified
            // must be the string being sent.
            const trimmed = dest.trim();
            const edges = addressEdges(trimmed);
            return (
              <>
                <Settle>
                  <View
                    style={{
                      paddingHorizontal: 22,
                      marginTop: 24,
                      alignItems: "center",
                    }}
                  >
                    <Label>Withdrawing</Label>
                    <Display size={40} style={{ marginTop: 10 }}>
                      {amount}{" "}
                      <Display size={22} color={C.figureTail}>
                        {asset.sym}
                      </Display>
                    </Display>
                    <Mono size={12.5} color={C.sub} style={{ marginTop: 8 }}>
                      ≈ ${usd} USD{pricesLive ? "" : " · snapshot price"}
                    </Mono>
                  </View>
                  <QuoteCard style={{ marginTop: 22, marginHorizontal: 22 }}>
                    <QuoteRow
                      label="Asset"
                      value={`${asset.name} · ${asset.sym}`}
                    />
                    <QuoteRow label="Network" value={asset.network} />
                    <QuoteRow
                      label="Amount"
                      value={`${amount} ${asset.sym}`}
                      strong
                    />
                    <QuoteRow
                      label="Network fee"
                      value="User paid"
                      tail="· deducted on-chain"
                      last
                    />
                  </QuoteCard>

                  {/* The whole address, ends weighted in gold — CheckoutSheet's
                      anti-poisoning discipline. Never `0x8335…2913`: that
                      ellipsis is the entire address-poisoning attack surface,
                      and this is the last screen where a wrong character can
                      still be caught. */}
                  <View style={{ marginHorizontal: 22, marginTop: 14 }}>
                    <View
                      style={{
                        backgroundColor: C.inset,
                        borderWidth: 1,
                        borderColor: C.hairline,
                        borderRadius: 16,
                        padding: 16,
                      }}
                    >
                      <Label>Destination</Label>
                      <Mono size={13} style={{ marginTop: 10, lineHeight: 21 }}>
                        <Mono
                          size={13}
                          color={C.brand}
                          style={{ fontFamily: F.monoSemibold }}
                        >
                          {edges.head}
                        </Mono>
                        <Mono size={13} color={C.text}>
                          {edges.middle}
                        </Mono>
                        <Mono
                          size={13}
                          color={C.brand}
                          style={{ fontFamily: F.monoSemibold }}
                        >
                          {edges.tail}
                        </Mono>
                      </Mono>
                      <Body
                        size={11.5}
                        color={C.sub}
                        style={{ marginTop: 10, lineHeight: 17 }}
                      >
                        Compare the gold characters at both ends against where
                        you meant to send. An address that differs anywhere is
                        not this one.
                      </Body>
                    </View>
                  </View>
                </Settle>
                <View style={{ flex: 1 }} />
                <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
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
                      label={sending ? "Signing…" : "Enter PIN & sign"}
                      loading={sending}
                      onPress={() => void signAndSend()}
                    />
                  </View>
                  <View style={{ marginTop: 10 }}>
                    <GhostButton
                      label="Back to amount"
                      onPress={() => {
                        setSendError(null);
                        setStep("amount");
                      }}
                    />
                  </View>
                </View>
              </>
            );
          })()
        : null}
    </View>
  );
}
