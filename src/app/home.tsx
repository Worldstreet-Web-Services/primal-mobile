import { router, type Href } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileHeader } from "@/components/home";
import { tagline } from "@/data/home";
import { user } from "@/data/mock";
import { useCryptoPortfolio } from "@/hooks/useCryptoPortfolio";
import { useFiatBalance, type FiatBalanceState } from "@/hooks/useLinkpay";
import { formatMoney } from "@/lib/gateway/money";
import { firstNameOf } from "@/lib/greeting";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";
import HomeScreen, { type HomeFigure } from "@/screens/HomeScreen";
import { C } from "@/theme/tokens";

/** Matches `HomeScreen`'s gutter, so the identity row lines up with the page. */
const GUTTER = 14;

// Destinations that exist today. Everything else on the shelves is designed
// but not yet routed — those taps intentionally no-op until the screen lands.
const FEATURE_ROUTES: Record<string, Href> = {
  "copy-trading": "/copy-trading",
  "auto-earn": "/auto-earn",
  fiat: "/fiat",
  crypto: "/crypto",
  games: "/games",
};

const MEDIA_ROUTES: Record<string, Href> = {
  podcast: "/podcast",
  news: "/news",
};

function open(table: Record<string, Href>, key: string) {
  const href = table[key];
  if (href) router.push(href);
}

/**
 * The naira balance, or the honest reason there isn't one.
 *
 * Every branch here is a state `useFiatBalance` can genuinely be in, and each
 * one says which way the figure is missing. The banned answer is the one this
 * screen used to give in all of them at once: `"$10,383.42"`, hardcoded in
 * `src/data/home.ts`, under the words TRADING BALANCE · IN USD.
 */
function nairaFigure(fiat: FiatBalanceState): HomeFigure {
  const label = "Naira balance";
  const currency = "in NGN";
  const missing = (
    note: string,
    action?: string,
    onAction?: () => void,
  ): HomeFigure => ({ state: "unavailable", label, currency, note, action, onAction });

  switch (fiat.phase) {
    case "loading":
      return { state: "loading" };
    case "signed_out":
      return missing("Sign in and your naira balance comes back with you.", "Sign in", () =>
        router.push("/signin"),
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
      return missing("The bank is still opening your naira account.", "See where it is", () =>
        router.push("/kyc"),
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
        return { state: "figure", label, currency, amount: formatMoney(available) };
      }
      if (fiat.balanceError) return missing(fiat.balanceError, "Try again", fiat.reload);
      return { state: "loading" };
    }
  }
}

/**
 * The crypto line. The quantities are read off the chains; the store flags a
 * failed read rather than reporting $0.00, and that flag is what this reads.
 */
function cryptoFigure(crypto: ReturnType<typeof useCryptoPortfolio>): HomeFigure {
  const label = "Crypto";
  if (crypto.error) {
    return {
      state: "unavailable",
      label,
      note: "Could not read your wallets",
    };
  }
  if (crypto.loading && crypto.holdings.length === 0) return { state: "loading" };
  return {
    state: "figure",
    label,
    amount: `$${crypto.totalUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  };
}

/**
 * Home.
 *
 * The two figures are shown side by side and never added together. A single
 * cross-space total would have to convert one into the other, and the only
 * NGN/USD rate in this app is a hand-typed constant (`USD_NGN` in
 * `lib/crypto/prices.ts`) — so a "total" would be a real balance plus an
 * invented conversion of another, which is the same lie in a longer sentence.
 * Two true figures beat one plausible one.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const fiat = useFiatBalance();
  const crypto = useCryptoPortfolio();

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      {/* Pinned: the identity row is a sibling of the scroll view rather than
          its first child, so it holds the top edge while the page moves under
          it. `HomeScreen` owns the scroll and knows nothing about this. */}
      <ProfileHeader
        name={firstNameOf(user.name)}
        tagline={tagline}
        unread
        onPress={() => router.push("/profile")}
        onNotifications={() => router.push("/pulse")}
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: GUTTER,
          paddingBottom: 6,
        }}
        avatar={require("@/assets/images/avatar.png")}
      />

      <HomeScreen
        balance={nairaFigure(fiat)}
        aside={cryptoFigure(crypto)}
        // No `onOpenBalance`: a tap on the card is tap-to-hide, and hooking a
        // push onto it would mask the figure on the way out of the screen.
        onOpenFeature={(key) => open(FEATURE_ROUTES, key)}
        onOpenMedia={(key) => open(MEDIA_ROUTES, key)}
      />
    </View>
  );
}
