import { router, type Href } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen from "@/screens/HomeScreen";
import { C } from "@/theme/tokens";

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

export default function Home() {
  // The identity row scrolls with the page now (2026-08-15 redesign), so
  // there's no floating header to measure — the content just clears the notch.
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <HomeScreen
        top={insets.top + 8}
        unread
        onOpenProfile={() => router.push("/profile")}
        onNotifications={() => router.push("/pulse")}
        onOpenFeature={(key) => open(FEATURE_ROUTES, key)}
        onOpenMedia={(key) => open(MEDIA_ROUTES, key)}
      />
    </View>
  );
}
