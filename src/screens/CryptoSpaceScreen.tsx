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
  Screen,
} from "../components/ui";
import { useCryptoPortfolio } from "../hooks/useCryptoPortfolio";
import { holdingQtyLabel } from "../lib/crypto/balances";
import { getCryptoWallet } from "../lib/crypto/wallet";
import { C } from "../theme/tokens";

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

// Design 2d: crypto space — per-chain balances, deposit/withdraw/buy doors.
export default function CryptoSpaceScreen({
  onPrices,
  top = 0,
}: {
  onPrices?: () => void;
  /** Head space for the floating nav header. */
  top?: number;
}) {
  const { holdings, totalUsd, loading, error, complete, pricesLive, refresh } =
    useCryptoPortfolio();

  /*
   * The screen's four states, mutually exclusive, worst news first.
   *
   * There used to be a fifth: a tagged mock list with a $312.40 demo total,
   * shown whenever the live read failed. It is gone entirely — a figure the
   * chains did not produce has no business on a balance screen, chip or no
   * chip. Every state below is either a real read or the reason there isn't
   * one.
   *
   * `walletless` is asked of the seam, not the store: the store flags both "no
   * addresses" and "chains unreachable" as `error`, and the two deserve
   * different sentences — one is fixed by signing in, the other by retrying.
   */
  const walletless = getCryptoWallet().getAddresses() === null;
  const failed = !walletless && error;
  const pending = !walletless && !failed && loading && holdings.length === 0;
  const live = !walletless && !failed && !pending;

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
    : [];
  const [whole, cents] = totalUsd.toFixed(2).split(".");

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
            ) : live && !complete ? (
              // The sum below is a floor, not a total — the chip flags it
              // before the eye reaches the figure.
              <MetaChip label="Partial read" tone="warn" />
            ) : live && !pricesLive && holdings.length > 0 ? (
              // Quantities are real; the DOLLAR figures are the hand-checked
              // snapshot because the market feed did not answer. BuyScreen
              // flags exactly this; a screen valuing real holdings owes the
              // same honesty.
              <MetaChip label="Snapshot prices" tone="warn" />
            ) : null}
          </View>
          {pending ? (
            <View style={{ marginTop: 12, gap: 13 }}>
              <PulseBlock width={214} height={40} radius={10} />
              <PulseBlock width={128} height={12} />
            </View>
          ) : walletless ? (
            // No addresses at the seam — nothing was read because there is
            // nothing to read, and no figure of any kind stands in for that.
            <Body
              size={13}
              color={C.sub}
              style={{ marginTop: 12, lineHeight: 20 }}
            >
              No wallet on this session. Sign in and your balance reads
              straight off the chains.
            </Body>
          ) : failed ? (
            <View style={{ marginTop: 12 }}>
              <Body size={13} color={C.sub} style={{ lineHeight: 20 }}>
                Paradigm could not read your wallets on-chain, so it does not
                know what they hold.
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
              <Display size={46} style={{ marginTop: 8 }}>
                ${Number(whole).toLocaleString("en-US")}
                <Display size={26} color={C.figureTail}>
                  .{cents}
                </Display>
              </Display>
              {complete ? null : (
                // `complete=false` means some chains never answered: the sum
                // above is only what could be seen, and saying so is the
                // difference between a floor and a lie.
                <Body
                  size={11.5}
                  color={C.sub}
                  style={{ marginTop: 8, lineHeight: 17 }}
                >
                  Some chains didn't answer — this is what could be read, not
                  your total. Pull again for the rest.
                </Body>
              )}
            </>
          )}
        </View>
      </Settle>

      <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <MetallicButton
            label="Prices"
            height={48}
            radius={14}
            size={13.5}
            onPress={onPrices}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton
            label="Deposit"
            height={48}
            radius={14}
            disabled
          />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton
            label="Withdraw"
            height={48}
            radius={14}
            disabled
          />
        </View>
      </View>
      <Body size={11} color={C.dim} style={{ marginTop: 10, lineHeight: 16 }}>
        Crypto deposit and withdrawal need public Gateway routes. Primal does
        not call Dextopus or treasury services directly from the app.
      </Body>

      {/* The list renders only in states where rows could exist. Signed out or
          failed, the headline above already carries the one reason there are
          no rows — repeating it here as an empty list would say it twice. */}
      {pending || live ? (
        <View style={{ marginTop: 26 }}>
          <SectionHead
            label="Holdings"
            right={
              pending ? null : complete ? (
                <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.3 }}>
                  {rows.length} {rows.length === 1 ? "ASSET" : "ASSETS"}
                </Mono>
              ) : (
                // A count implies the list is whole. On a partial read it
                // isn't, so the corner states that instead of a number.
                <MetaChip label="Some chains missing" tone="warn" />
              )
            }
          />
          <View style={{ marginTop: 2 }}>
            {pending ? (
              <RowSkeletonList rows={3} />
            ) : rows.length === 0 && complete ? (
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
                  Assets appear here when your self-custody wallet receives them.
                </Body>
              </View>
            ) : rows.length === 0 ? (
              // Zero rows on a PARTIAL read is not an empty wallet — it is
              // "the chains that answered showed nothing", which is weaker.
              <View style={{ paddingVertical: 26, alignItems: "center" }}>
                <Body size={13} color={C.sub}>
                  Nothing read yet
                </Body>
                <Body
                  size={11.5}
                  color={C.dim}
                  style={{
                    marginTop: 5,
                    textAlign: "center",
                    lineHeight: 17,
                  }}
                >
                  The chains that answered show nothing, and some didn't
                  answer.
                </Body>
                <View style={{ marginTop: 14 }}>
                  <GhostButton
                    label="Read again"
                    height={38}
                    radius={12}
                    onPress={() => void refresh()}
                    style={{ paddingHorizontal: 22 }}
                  />
                </View>
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
      ) : null}

      {/* There was an "Auto-convert deposits to ₦" toggle here — local state,
          wired to nothing, default ON, promising that incoming crypto settles
          into the fiat balance. No such rail exists: the deposit sheet says so
          plainly, and a control that promises it anyway is a fabricated fact
          with a switch attached. It returns when the NGN leg genuinely does. */}

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
          Keys split three ways — device · Decane · recovery.{"\n"}Sends
          confirm with your Paradigm PIN and are signed on this device.
        </Body>
        <Label style={{ letterSpacing: 1.6 }}>
          Self-custody · signed on device
        </Label>
      </View>
    </Screen>
  );
}
