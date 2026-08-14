import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NavHeader } from "@/components/home";
import { SparkleIcon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui";
import AutoEarnScreen from "@/screens/AutoEarnScreen";
import { C } from "@/theme/tokens";

const CTA_HEIGHT = 56;

export default function AutoEarn() {
  const [headerHeight, setHeaderHeight] = useState(0);
  const insets = useSafeAreaInsets();

  // Sits on the bottom edge, clear of the home indicator. Nothing floats below
  // it any more, so the old tab-bar offset would just leave a gap.
  const ctaBottom = Math.max(insets.bottom, 16);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <AutoEarnScreen top={headerHeight} bottom={ctaBottom + CTA_HEIGHT + 24} />

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: ctaBottom,
        }}
      >
        <PrimaryButton
          label="Buy & hold"
          height={CTA_HEIGHT}
          icon={<SparkleIcon size={16} />}
        />
      </View>

      <NavHeader
        wordmark="AUTO EARN"
        tagline="POWERED BY ARK"
        direction="column"
        unread
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
