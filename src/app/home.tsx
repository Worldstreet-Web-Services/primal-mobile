import { router, type Href } from "expo-router";

import {
  TABS,
  useBalanceMasked,
  type FeatureStatus,
  type FeatureTileItem,
  type MissingLeg,
  type MoneyLeg,
  type PortfolioView,
} from "@/components/home";
import { features as catalogue, sampleActivity } from "@/data/home";
import { user } from "@/data/mock";
import { useCryptoPortfolio } from "@/hooks/useCryptoPortfolio";
import { useFiatBalance, type FiatBalanceState } from "@/hooks/useLinkpay";
import { sampleActivity as showSampleActivity } from "@/lib/devMode";
import { formatMoney, isZeroMoney } from "@/lib/gateway/money";
import { firstNameOf, greetingFor } from "@/lib/greeting";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";
import HomeScreen from "@/screens/HomeScreen";

// Destinations that exist today. Everything else on the shelves is designed
// but not yet routed — those tiles render as SOON and do not respond to a tap.
const FEATURE_ROUTES: Record<string, Href> = {
  "copy-trading": "/copy-trading",
  "auto-earn": "/auto-earn",
  fiat: "/fiat",
  crypto: "/crypto",
  games: "/games",
};

/**
 * Routed, but with nothing behind the route.
 *
 * Auto Earn and Copy Trading are ARK/WorldStreet surfaces: the screens exist
 * and render, and there is no Paradigm backend under either of them — no
 * gateway path, no store, nothing that could make a number on them true. The
 * tile still opens them, and says PREVIEW on the door so opening one is not
 * mistaken for a working feature. Take a key out of this set the day a real
 * endpoint lands, and not before.
 */
const PREVIEW_SURFACES = new Set(["auto-earn", "copy-trading"]);

const MEDIA_ROUTES: Record<string, Href> = {
  podcast: "/podcast",
  news: "/news",
};

/**
 * Where the tab bar goes. Read off `TABS` rather than written out again, so a
 * tab can never exist on the bar without a destination here or vice versa —
 * a tab with no `href` is deliberately unbuilt and the bar draws it inert.
 */
const TAB_ROUTES: Record<string, Href> = Object.fromEntries(
  TABS.filter((t) => t.href).map((t) => [t.key, t.href as Href]),
);

function open(table: Record<string, Href>, key: string) {
  const href = table[key];
  if (href) router.push(href);
}

function statusFor(key: string): FeatureStatus {
  if (!(key in FEATURE_ROUTES)) return "soon";
  return PREVIEW_SURFACES.has(key) ? "preview" : "live";
}

/**
 * The doorways, in data order, deduplicated by key.
 *
 * The client's mockup shows six tiles including "Copy Trading" twice and
 * "Crypto" twice — a mockup artifact, not a spec. Two tiles with the same key
 * would also be two React children with the same key, so the dedupe is load
 * bearing rather than decorative.
 */
const TILES: FeatureTileItem[] = catalogue
  .filter((f, i, all) => all.findIndex((x) => x.key === f.key) === i)
  .map((f) => ({ ...f, status: statusFor(f.key) }));

/* ------------------------------------------------------------------- legs */

/**
 * One currency's worth of money, or the honest reason there isn't one.
 *
 * `zero` is not cosmetic: it is the only thing that makes a cross-currency
 * total expressible at all. See `portfolioView`.
 */
type LegRead =
  | { kind: "loading" }
  | { kind: "figure"; leg: MoneyLeg; zero: boolean }
  | { kind: "missing"; missing: MissingLeg };

/**
 * The naira leg.
 *
 * Every branch is a state `useFiatBalance` can genuinely be in, and each one
 * says which way the figure is missing. The banned answer is the one this
 * screen used to give in all of them at once: `"$10,383.42"`, hardcoded in
 * `src/data/home.ts`, under the words TRADING BALANCE · IN USD.
 */
function nairaLeg(fiat: FiatBalanceState): LegRead {
  const label = "Naira";
  const missing = (
    note: string,
    action?: string,
    onAction?: () => void,
  ): LegRead => ({
    kind: "missing",
    missing: { key: "naira", label, note, action, onAction },
  });

  switch (fiat.phase) {
    case "loading":
      return { kind: "loading" };
    case "signed_out":
      return missing(
        "Sign in and your naira balance comes back with you.",
        "Sign in",
        () => router.push("/signin"),
      );
    case "unentitled":
      return missing(
        "Naira is part of a Paradigm subscription. Your sign-in is fine — the subscription is what is missing.",
        "See the plan",
        () => router.push(SUBSCRIPTION_ROUTE),
      );
    case "activating":
      // Never the paywall from here either. See `useLinkpay.ts`.
      return missing(
        fiat.activation === "payment"
          ? "Your subscription payment is still on its way. Nothing needs paying twice."
          : "Your payment is in and the gateway is still switching the naira side on.",
        "Check now",
        fiat.reload,
      );
    case "no_account":
      return missing(
        "You have not opened a naira account yet. One check opens an account number in your own name.",
        "Open one",
        () => router.push("/kyc"),
      );
    case "provisioning":
      return missing(
        "The bank is still opening your naira account.",
        "See where it is",
        () => router.push("/kyc"),
      );
    case "provision_failed":
      return missing(
        "That naira account could not be opened, so there is no balance behind it.",
        "Try again",
        () => router.push("/kyc"),
      );
    case "disabled":
      return missing(
        "Your naira account is switched off. Nothing in it has moved — support can turn it back on.",
      );
    case "unknown_status":
      return missing(
        "Paradigm does not recognise the state your naira account is in, so it will not show a figure it cannot vouch for.",
        "Check again",
        fiat.reload,
      );
    case "error":
      return missing(
        fiat.error ?? "Something went wrong reaching Paradigm.",
        "Try again",
        fiat.reload,
      );
    default: {
      // Account is ACTIVE. The balance is its own request with its own answer:
      // a figure, a stated refusal to guess at one, or still in the air.
      const available = fiat.balance?.available;
      if (available) {
        // `formatMoney` never throws, but `isZeroMoney` does — a minor-unit
        // amount that will not parse as an integer cannot be classified, and a
        // leg that cannot be classified must not be counted as a genuine zero.
        let zero: boolean;
        try {
          zero = isZeroMoney(available);
        } catch {
          return missing(
            "The gateway sent a naira balance Paradigm could not read, so it will not show a figure it cannot vouch for.",
            "Try again",
            fiat.reload,
          );
        }
        return {
          kind: "figure",
          leg: { key: "naira", label, amount: formatMoney(available) },
          zero,
        };
      }
      if (fiat.balanceError)
        return missing(fiat.balanceError, "Try again", fiat.reload);
      return { kind: "loading" };
    }
  }
}

/**
 * The crypto leg. The quantities are read off the chains and priced; the store
 * flags a failed read rather than reporting $0.00, and that flag is what this
 * reads. `error` also covers "there are no wallet addresses to read", which is
 * why the note does not claim to know which of the two happened.
 */
function cryptoLeg(crypto: ReturnType<typeof useCryptoPortfolio>): LegRead {
  const label = "Crypto";
  if (crypto.error) {
    return {
      kind: "missing",
      missing: {
        key: "crypto",
        label,
        note: "Paradigm could not read your wallets on-chain, so it does not know what they hold.",
        action: "Try again",
        onAction: () => void crypto.refresh(),
      },
    };
  }
  if (crypto.loading && crypto.holdings.length === 0)
    return { kind: "loading" };
  return {
    kind: "figure",
    leg: {
      key: "crypto",
      label,
      amount: `$${crypto.totalUsd.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    // A zero may ONLY be claimed when every chain answered.
    //
    // `error` is not enough on its own: the store flags it solely when EVERY
    // chain job fails, so one chain answering while six fail arrives here as
    // `error: false` with an empty list. Read as a genuine zero, that promotes
    // the naira balance to a headline TOTAL PORTFOLIO with "CRYPTO $0.00"
    // printed under it — a leg of unknown size counted as nothing, which is the
    // exact defect this screen was rebuilt to remove. `complete` is what
    // separates "your wallets hold nothing" from "we only saw part of them".
    zero: crypto.complete && crypto.holdings.length === 0,
  };
}

/* -------------------------------------------------------------- the total */

const NO_RATE =
  "Your naira and your crypto are held in different currencies, and Paradigm has no exchange rate it can stand behind — so it shows both rather than adding them into one number.";

/**
 * "Total Portfolio", and the two reasons it often cannot be one.
 *
 * The client's reference puts a single aggregate at the top of the screen. The
 * app holds naira through LinkPay and crypto on-chain, so that aggregate needs
 * an FX rate — and there is no rate. The gateway quotes none (`/v1/auth/*`,
 * `/v1/linkpay/*` and `/v1/subscriptions/*` are the whole surface), and the
 * hand-typed `USD_NGN` constant that used to sit in `src/lib/crypto/prices.ts`
 * has been deleted for the same reason this function exists: multiplying a real
 * balance by a number nobody stands behind does not produce a total, it
 * produces the invented figure this screen was rescued from, laundered through
 * arithmetic.
 *
 * So a single figure is only ever shown when it needs no rate:
 *
 *   1. every leg is readable — an unknown leg has no size, so any total that
 *      included it would be a guess; and
 *   2. at most one readable leg is non-zero — adding a genuine zero across
 *      currencies is exact whatever the rate turns out to be.
 *
 * Otherwise the card shows both figures without summing them (`split`), or the
 * em dash with the reason the missing leg is missing (`blocked`). A partial
 * total presented as "Total Portfolio" would be a lie, and so would a zero.
 */
function portfolioView(
  fiat: FiatBalanceState,
  crypto: ReturnType<typeof useCryptoPortfolio>,
): PortfolioView {
  const reads = [nairaLeg(fiat), cryptoLeg(crypto)];
  if (reads.some((r) => r.kind === "loading")) return { state: "loading" };

  const figures = reads.filter(
    (r): r is Extract<LegRead, { kind: "figure" }> => r.kind === "figure",
  );
  const missing = reads
    .filter(
      (r): r is Extract<LegRead, { kind: "missing" }> => r.kind === "missing",
    )
    .map((r) => r.missing);

  const legs = figures.map((f) => f.leg);
  if (missing.length > 0) return { state: "blocked", legs, missing };

  const funded = figures.filter((f) => !f.zero);
  if (funded.length > 1) return { state: "split", legs, note: NO_RATE };

  // One funded leg — or none, in which case every leg is zero and so is the
  // total, in whichever currency it is stated.
  const amount = (funded[0] ?? figures[0]).leg.amount;
  return { state: "total", amount, legs };
}

/**
 * Home.
 *
 * There is no delta line under the figure. The reference shows "+12.4%
 * (+$200.69)" and there is nothing in this app that could produce it: the whole
 * gateway surface is `/v1/auth/*`, `/v1/linkpay/*` and `/v1/subscriptions/*`,
 * none of which returns a historical balance or a P&L; `getBalance` is a
 * point-in-time reading; and the crypto store holds current quantities at spot
 * prices with no earlier snapshot to compare them to. Deriving one from the
 * first reading of a session would be a number about how long the app has been
 * open, wearing a percentage sign. The slot under the figure carries the legs
 * the total is made of instead — which is sourced, and stays true.
 */
export default function Home() {
  const fiat = useFiatBalance();
  const crypto = useCryptoPortfolio();
  const [masked, toggleMasked] = useBalanceMasked();

  return (
    <HomeScreen
      greeting={greetingFor()}
      name={firstNameOf(user.name)}
      portfolio={portfolioView(fiat, crypto)}
      masked={masked}
      onToggleMasked={toggleMasked}
      features={TILES}
      activity={showSampleActivity ? sampleActivity : []}
      tab="home"
      onSelectTab={(key) => open(TAB_ROUTES, key)}
      onOpenFeature={(key) => open(FEATURE_ROUTES, key)}
      onOpenMedia={(key) => open(MEDIA_ROUTES, key)}
      onNotifications={() => router.push("/pulse")}
      onOpenProfile={() => router.push("/profile")}
      onDeposit={() => router.push("/fund")}
      onTransfer={() => router.push("/send")}
    />
  );
}
