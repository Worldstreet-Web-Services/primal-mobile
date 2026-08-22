import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import { Sheet } from "@/components/Sheet";
import FundingOptions from "@/components/shared/funding-options";
import CopyTradingScreen from "@/screens/CopyTradingScreen";
import { C } from "@/theme/tokens";

export default function CopyTrading() {
  const [funding, setFunding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Pull to refresh.
   *
   * There is nothing behind it yet: Worldstreet owns the copy-trading feed (PRD
   * §F6) and every figure on this screen comes from `src/data/traders.ts`, so
   * this turns the spinner over and puts it away. It is wired end to end so the
   * gesture is real — replace the body with the read when the endpoint lands,
   * and nothing above it has to change.
   */
  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <PageHeader title="Copy Trading" onBack={() => router.back()} />

      <CopyTradingScreen
        refreshing={refreshing}
        onRefresh={refresh}
        onDeposit={() => setFunding(true)}
        onOpenTrader={(id) => router.push(`/copy-trading/${id}`)}
        // Mirroring is Worldstreet's call (PRD §F6). Until that endpoint lands,
        // Copy opens the leader's profile — the confirm belongs on the page that
        // states what you would be copying, not on a tap in a list.
        onCopy={(id) => router.push(`/copy-trading/${id}`)}
        // `onSeeAll` and `onOpenPositions` stay unwired until the full
        // leaderboard and the positions screen exist. Passing a handler that
        // goes nowhere is what makes a screen feel broken.
      />

      {/* Summoned by the Deposit action, so it is dismissible — drag it down, tap
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
