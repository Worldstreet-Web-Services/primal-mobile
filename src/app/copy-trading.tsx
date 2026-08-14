import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import CopyTradingScreen from "@/screens/CopyTradingScreen";
import { C } from "@/theme/tokens";

export default function CopyTrading() {
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <CopyTradingScreen top={headerHeight} />
      <NavHeader
        wordmark="COPY TRADING"
        tagline="POWERED BY WORLDSTREET"
        direction="column"
        unread
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
