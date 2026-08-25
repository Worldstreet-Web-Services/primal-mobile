import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import CryptoSpaceScreen from "@/screens/CryptoSpaceScreen";
import { C } from "@/theme/tokens";

export default function Crypto() {
  // The header floats over the scroll view, so the content starts below it —
  // measured, since the safe area and the masthead both move it.
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <CryptoSpaceScreen
        top={headerHeight}
        onPrices={() => router.push("/buy")}
      />
      <NavHeader
        wordmark="CRYPTO"
        tagline="SELF-CUSTODY · READ ONLY"
        direction="column"
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
