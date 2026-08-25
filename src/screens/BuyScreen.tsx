import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import {
  InstrumentRow,
  MetaChip,
  RowSkeletonList,
  SectionHead,
  Settle,
} from "../components/crypto";
import {
  BackHeader,
  Body,
  Card,
  GhostButton,
  Mono,
  Screen,
} from "../components/ui";
import { TOKEN_CATALOG } from "../lib/crypto/catalog";
import { fetchPricesUsd } from "../lib/crypto/prices";
import { C } from "../theme/tokens";

/*
 * Buy — real prices, and the truth about buying.
 *
 * This screen used to be a complete purchase flow: hardcoded naira prices
 * ("₦161,224,000" per BTC, typed by hand), invented 24h deltas, an amount
 * keypad, a PIN gate that verified nothing, and a "Bought and holding" success
 * screen after which the user owned nothing. Every stage of it was theatre —
 * there is no fiat→crypto rail anywhere behind this app (no gateway route
 * sells crypto for naira), and there is no NGN/USD rate to even price the
 * theatre in.
 *
 * So the screen now shows USD prices through the same seam that values the
 * portfolio, and says plainly that buying needs a public Gateway contract.
 */

interface BuyAsset {
  sym: string;
  name: string;
  /** Dollar-pegged — the disc carries the stable accent, as on every list. */
  stable: boolean;
}

/**
 * One row per distinct symbol in the on-chain catalog — the assets a deposit
 * can actually land as. Natives lead, dollar-pegged follow, so the rows that
 * move sit above the rows that by design do not.
 */
const ASSETS: BuyAsset[] = (() => {
  const seen = new Set<string>();
  const out: BuyAsset[] = [];
  for (const t of TOKEN_CATALOG) {
    if (seen.has(t.symbol)) continue;
    seen.add(t.symbol);
    out.push({ sym: t.symbol, name: t.name, stable: t.stable ?? false });
  }
  return [...out.filter((a) => !a.stable), ...out.filter((a) => a.stable)];
})();

/** Sub-dollar assets need their working digits; everything else takes cents. */
const priceLabel = (p: number) =>
  `$${p.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: p < 1 ? 4 : 2,
  })}`;

/**
 * Whether a live overlay is even possible. The price seam degrades silently —
 * no key means it returns its hand-checked snapshot without touching the
 * network — and a screen whose whole content is prices must not stamp
 * snapshot values with an "as of <now>" that implies the market was asked.
 * With no key configured, the answer is knowable before asking: it wasn't.
 */
const HAS_PRICE_FEED = Boolean(process.env.EXPO_PUBLIC_ALCHEMY_API_KEY);

export default function BuyScreen({ onBack }: { onBack?: () => void }) {
  const [prices, setPrices] = useState<Record<string, number> | null>(null);
  /** When WE asked — the one timestamp this screen can honestly put on them. */
  const [asOf, setAsOf] = useState<Date | null>(null);
  /**
   * Whether every listed asset was priced by the live API on this pass. The
   * fetcher degrades to its static snapshot on any failure WITHOUT throwing,
   * so a configured key is no proof the market answered — a keyed-but-offline
   * session used to stamp "AS OF 14:32" over the hand-checked snapshot, which
   * is the exact lie the chip below exists to prevent.
   */
  const [liveQuotes, setLiveQuotes] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    setPrices(null);
    setAsOf(null);
    setLiveQuotes(false);
    try {
      const { prices: out, live } = await fetchPricesUsd(ASSETS.map((a) => a.sym));
      setPrices(out);
      setLiveQuotes(ASSETS.every((a) => live.has(a.sym)));
      setAsOf(new Date());
    } catch {
      // fetchPricesUsd degrades internally rather than throwing, so reaching
      // here is unexpected — but an unexpected failure still gets an honest
      // panel, never a stand-in figure.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = prices === null && !failed;

  return (
    <Screen pad={22}>
      <BackHeader title="Market prices" onBack={onBack} />

      <View style={{ marginTop: 24 }}>
        <SectionHead
          label="Prices · USD"
          right={
            !pending && !failed && !liveQuotes ? (
              // Not a timestamp: whether the key is missing or the market
              // simply did not answer, these are snapshot values, and
              // "as of 14:32" over a snapshot would be a lie.
              <MetaChip label="Snapshot · not live" tone="warn" />
            ) : asOf ? (
              <Mono size={9.5} color={C.dim} style={{ letterSpacing: 1.3 }}>
                AS OF{" "}
                {asOf
                  .toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  .toUpperCase()}
              </Mono>
            ) : null
          }
        />
        <View style={{ marginTop: 2 }}>
          {pending ? (
            <RowSkeletonList rows={ASSETS.length} />
          ) : failed ? (
            <View style={{ paddingVertical: 24 }}>
              <Body size={12.5} color={C.sub} style={{ lineHeight: 19 }}>
                Paradigm could not fetch prices, so it will not show you old
                ones as if they were current.
              </Body>
              <View style={{ marginTop: 14, alignSelf: "flex-start" }}>
                <GhostButton
                  label="Try again"
                  height={40}
                  radius={12}
                  onPress={() => void load()}
                  style={{ paddingHorizontal: 22 }}
                />
              </View>
            </View>
          ) : (
            ASSETS.map((a, i) => (
              <InstrumentRow
                key={a.sym}
                symbol={a.sym}
                name={a.name}
                sub={a.sym}
                value={prices?.[a.sym] != null ? priceLabel(prices[a.sym]) : "—"}
                // An em dash needs its reason beside it, or it reads as a bug.
                meta={prices?.[a.sym] != null ? undefined : "no source priced it"}
                stable={a.stable}
                last={i === ASSETS.length - 1}
              />
            ))
          )}
        </View>
        {/* No 24h column. The old "+2.4% · 24h" deltas were typed into the
            file, and the price seam returns spot values only — a movement
            figure needs a source that reports movement. */}
        {pending || failed ? null : (
          <Body size={11} color={C.dim} style={{ marginTop: 12, lineHeight: 16 }}>
            {HAS_PRICE_FEED
              ? "Live from the market feed when it answers; otherwise the last hand-checked snapshot stands. USD only — no naira rate is quoted anywhere yet, so none is shown."
              : "This build has no market-feed key, so these are the last hand-checked snapshot prices — indicative, not live. USD only — no naira rate is quoted anywhere yet, so none is shown."}
          </Body>
        )}
      </View>

      <Settle>
        <Card style={{ marginTop: 26, padding: 18, borderRadius: 18 }}>
          <Body size={13.5} semibold>
            Buying needs a Gateway contract
          </Body>
          <Body
            size={12}
            color={C.sub}
            style={{ marginTop: 8, lineHeight: 18 }}
          >
            API v0.1 exposes no naira→crypto quote, conversion, settlement, or
            status route. Prices are informational; Primal will not mime a
            purchase or call a provider directly from the app.
          </Body>
        </Card>
      </Settle>
    </Screen>
  );
}
