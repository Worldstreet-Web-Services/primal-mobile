import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import CryptoSpaceScreen from "@/screens/CryptoSpaceScreen";

export default function Crypto() {
  // The header floats over the scroll view, so the content starts below it —
  // measured, since the safe area and the masthead both move it.
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View className="flex-1 bg-canvas">
      <CryptoSpaceScreen
        top={headerHeight}
        onBuy={() => router.push("/buy")}
        onDeposit={() => router.push("/receive")}
        onWithdraw={() => router.push("/withdraw")}
      />
      <NavHeader
        wordmark="CRYPTO"
        tagline="POWERED BY LINKPAY"
        direction="column"
        unread
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
