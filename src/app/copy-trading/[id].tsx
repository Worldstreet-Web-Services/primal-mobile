import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import TradeDetailScreen from "@/screens/TradeDetailScreen";
import { tradeDetail } from "@/data/trades";
import { C, F } from "@/theme/tokens";

export default function TradeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const detail = id ? tradeDetail(id) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <PageHeader title="Copy Trading" onBack={() => router.back()} />

      {detail ? (
        <TradeDetailScreen
          detail={detail}
          onDismiss={() => router.back()}
          // Mirroring is Worldstreet's call (PRD §F6) — until that endpoint
          // lands, confirming just returns to the feed.
          onCopy={() => router.back()}
        />
      ) : (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontFamily: F.body, fontSize: 14, color: C.sub }}>
            That position is no longer open.
          </Text>
        </View>
      )}
    </View>
  );
}
