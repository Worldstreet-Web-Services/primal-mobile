import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import HubHomeScreen from "@/screens/HubHomeScreen";
import { C } from "@/theme/tokens";

// The four locked spaces: Auto Earn (Kash), Copy Trading (Worldstreet),
// Crypto (LinkPay), Games (Ark).
const ROUTES: Record<string, Href> = {
  earn: "/earn",
  trade: "/trade",
  crypto: "/crypto",
  games: "/games",
};

export default function Hub() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <HubHomeScreen
        onOpen={(space) => {
          const href = ROUTES[space];
          if (href) router.push(href);
        }}
        onProfile={() => router.push("/profile")}
      />
    </SafeAreaView>
  );
}
