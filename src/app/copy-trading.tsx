import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import FundingOptions from "@/components/shared/funding-options";
import CopyTradingScreen from "@/screens/CopyTradingScreen";
import { C } from "@/theme/tokens";

export default function CopyTrading() {
  const [funding, setFunding] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <PageHeader title="Copy Trading" onBack={() => router.back()} />

      <CopyTradingScreen
        onFund={() => setFunding(true)}
        onCopy={(id) => router.push(`/copy-trading/${id}`)}
      />

      {/* Summoned by the Fund action, so it is dismissible — drag it down, tap
          the scrim, or Android back. `GlassDrawer` is the wrong tool here: it
          is fixed chrome that slides in once and stays.

          `sheet={false}` keeps the whole flow on this one surface: the checkout
          replaces the option list rather than stacking a second modal on top of
          it, so its back arrow returns to the list and only × or a drag ends
          the flow. */}
      <Sheet
        visible={funding}
        onClose={() => setFunding(false)}
        tintOpacity={0.85}
        draggable
      >
        <FundingOptions
          sheet={false}
          onClose={() => setFunding(false)}
          onConfirm={() => setFunding(false)}
        />
      </Sheet>
    </View>
  );
}
