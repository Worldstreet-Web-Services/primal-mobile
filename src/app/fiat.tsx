import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import FiatSpaceScreen from "@/screens/FiatSpaceScreen";
import { C } from "@/theme/tokens";

// The LinkPay-powered fiat space: account number, deposits, activity.
export default function Fiat() {
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <FiatSpaceScreen
        top={headerHeight}
        onAdd={() => router.push("/fund")}
        onSend={() => router.push("/send")}
        // onRemit intentionally not passed — cross-border is out of this
        // version, so the Remit action hides itself. Restore by passing it.
      />
      <NavHeader
        wordmark="FIAT"
        tagline="POWERED BY LINKPAY"
        direction="column"
        unread
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
