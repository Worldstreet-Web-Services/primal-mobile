import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import { MoreIcon } from "@/components/icons";
import { Body } from "@/components/ui";
import { traderById } from "@/data/traders";
import TraderProfileScreen from "@/screens/TraderProfileScreen";
import { C } from "@/theme/tokens";

/**
 * One leader's profile. Everything that opens a trader on the copy-trading
 * feed — the rail card, the ranked row, and the Copy pill inside both — lands
 * here, because the confirm belongs on the page that states what you would be
 * copying rather than on a tap in a list.
 */
export default function TraderProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trader = id ? traderById(id) : undefined;

  return (
    <View className="flex-1 bg-canvas">
      <PageHeader
        title="Trader Profile"
        align="left"
        onBack={() => router.back()}
        right={
          // Drawn but inert: report, share and mute all belong behind it and
          // none of them exist yet.
          <Pressable hitSlop={10} disabled accessibilityElementsHidden>
            <MoreIcon size={20} color={C.text} />
          </Pressable>
        }
      />

      {trader ? (
        <TraderProfileScreen
          trader={trader}
          // Mirroring is Worldstreet's call (PRD §F6) — until that endpoint
          // lands, nothing is actually mirrored and the flow goes straight to
          // its last page. `replace`, not `push`: back from a confirmed
          // decision must not land on the screen that asked for it.
          onStartCopying={(traderId, stake) =>
            router.replace(
              `/copy-trading/activated?id=${encodeURIComponent(traderId)}&amount=${stake}`,
            )
          }
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
