import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { Body } from "@/components/ui";
import { defaultInvestment, safetyStopRatio, traderById } from "@/data/traders";
import CopyActivatedScreen from "@/screens/CopyActivatedScreen";

/**
 * Copying activated.
 *
 * A static segment, so it wins over `[id]` in the same folder — a leader whose
 * id was literally "activated" would be unreachable, and none is.
 *
 * The stake arrives in the query rather than in a store because there is no
 * store: mirroring is Worldstreet's (PRD §F6), so what this page states is what
 * the previous page sent it, and nothing else knows about it.
 */
export default function CopyActivated() {
  const { id, amount } = useLocalSearchParams<{
    id?: string;
    amount?: string;
  }>();

  const trader = id ? traderById(id) : undefined;
  const invested = Number(amount) || defaultInvestment;

  return (
    // No header: there is nothing to go back to that is not the confirm screen
    // for a decision already made.
    <View className="flex-1 bg-canvas">
      {trader ? (
        <CopyActivatedScreen
          trader={trader}
          amount={invested}
          // The floor the profile screen put under the stake. It is recomputed
          // from the same ratio rather than passed along, which means it does
          // NOT yet know about the profile's safety-stop toggle — flip that off
          // and this page still states a stop. Pass `null` here the day
          // `onStartCopying` carries the switch.
          stop={invested * safetyStopRatio}
          onViewProfile={() =>
            router.replace(`/copy-trading/${encodeURIComponent(trader.id)}`)
          }
          onDashboard={() => router.replace("/home")}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <Body className="text-[14px] text-sub">
            That trader is no longer listed.
          </Body>
        </View>
      )}
    </View>
  );
}
