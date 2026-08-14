import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import PortfolioScreen from "@/screens/PortfolioScreen";

/** Clears the floating tab bar, matching the other tab roots. */
const TAB_BAR_CLEARANCE = 130;

// Tab root, so there is nothing to go back to — the screen renders its own
// plain title instead of a back header.
export default function Portfolio() {
  return (
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: "#0A0B0D" }}
    >
      <PortfolioScreen
        bottom={TAB_BAR_CLEARANCE}
        onBuy={() => router.push("/buy")}
        onWithdraw={() => router.push("/withdraw")}
      />
    </SafeAreaView>
  );
}
