import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import PortfolioScreen from "@/screens/PortfolioScreen";

// Pushed route now that the tab bar is gone, so the screen keeps its own plain
// title and the default tail space — nothing floats over the content.
export default function Portfolio() {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-canvas">
      <PortfolioScreen
        onBuy={() => router.push("/buy")}
        onWithdraw={() => router.push("/withdraw")}
      />
    </SafeAreaView>
  );
}
