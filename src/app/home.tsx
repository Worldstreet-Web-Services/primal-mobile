import { router, type Href } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileHeader } from "@/components/home";
import { tagline } from "@/data/home";
import { user } from "@/data/mock";
import { firstNameOf } from "@/lib/greeting";
import HomeScreen from "@/screens/HomeScreen";
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

export default function Home() {
  const insets = useSafeAreaInsets();

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
      />

      <HomeScreen
        onOpenFeature={(key) => open(FEATURE_ROUTES, key)}
        onOpenMedia={(key) => open(MEDIA_ROUTES, key)}
      />
    </View>
  );
}
