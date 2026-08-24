import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlusIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import FundingOptions from "@/components/shared/funding-options";
import { Sheet } from "@/components/Sheet";
import { GlassButton } from "@/components/ui";
import AutoEarnScreen from "@/screens/AutoEarnScreen";
import { C } from "@/theme/tokens";
import { useState } from "react";

const CTA_HEIGHT = 56;

export default function AutoEarn() {
  const insets = useSafeAreaInsets();
  const [funding, setFunding] = useState(false);

  // Sits on the bottom edge, clear of the home indicator. Nothing floats below
  // it any more, so the old tab-bar offset would just leave a gap.
  const ctaBottom = Math.max(insets.bottom, 16);

  return (
    <View className="flex-1 bg-canvas">
      {/* In flow, not floating — the scroll starts beneath it, so the screen
          needs no head space of its own. */}
      <PageHeader title="Yield" onBack={() => router.back()} />

      <AutoEarnScreen bottom={ctaBottom + CTA_HEIGHT + 24} />

      {/* Funding is a page-level action, so it floats over the list rather than
          belonging to any one row — centred and sized to its label, so the
          rows either side of it stay readable through the glass. */}
      <View
        pointerEvents="box-none"
        className="absolute left-[16px] right-[16px] items-center"
        style={{
          bottom: ctaBottom,
        }}
      >
        <GlassButton
          label="Add money"
          height={CTA_HEIGHT}
          icon={<PlusIcon size={15} color={C.text} />}
          onPress={() => setFunding(true)}
        />
      </View>

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
