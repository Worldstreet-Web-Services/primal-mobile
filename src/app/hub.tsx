import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import HubHomeScreen from "@/screens/HubHomeScreen";

// Spaces that exist in the kit today; the rest of the tiles (trade, earn,
// games, remit) present but don't navigate yet — their screens land with the
// next design drop (3a-3f in the README mapping).
const ROUTES: Record<string, Href> = {
  fiat: "/fiat",
  crypto: "/crypto",
};

export default function Hub() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <HubHomeScreen
        onOpen={(space) => {
          const href = ROUTES[space];
          if (href) router.push(href);
        }}
      />
    </SafeAreaView>
  );
}
