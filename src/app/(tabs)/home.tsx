import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import HomeScreen from "@/screens/HomeScreen";
import { C } from "@/theme/tokens";

// Destinations that exist today. Everything else on the shelves is designed
// but not yet routed — those taps intentionally no-op until the screen lands.
const SPACE_ROUTES: Record<string, Href> = {
  // LinkPay's surface is the account number (the fiat space folded into
  // crypto when the hub went four-space; /fiat no longer exists).
  linkpay: "/receive",
  market: "/crypto",
  worldstreet: "/copy-trading",
  kash: "/auto-earn",
};

const FEATURE_ROUTES: Record<string, Href> = {
  "copy-trading": "/copy-trading",
  "auto-earn": "/auto-earn",
  fiat: "/fiat",
  crypto: "/crypto",
  games: "/games",
};
const MEDIA_ROUTES: Record<string, Href> = {};

function open(table: Record<string, Href>, key: string) {
  const href = table[key];
  if (href) router.push(href);
}

export default function Home() {
  // The header floats over the scroll view, so the content needs to start
  // below it — measured rather than guessed, since the safe area and the
  // header's own direction both move it.
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <HomeScreen
        top={headerHeight}
        onSelectSpace={(key) => open(SPACE_ROUTES, key)}
        onOpenFeature={(key) => open(FEATURE_ROUTES, key)}
        onOpenMedia={(key) => open(MEDIA_ROUTES, key)}
      />
      {/* Wordmark only — "simple asf" pass, 2026-08-14. */}
      <NavHeader unread tagline="" onHeightChange={setHeaderHeight} />
    </View>
  );
}
