import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import { SparkleIcon } from "@/components/icons";
import { PrimaryButton } from "@/components/ui";
import AutoEarnScreen from "@/screens/AutoEarnScreen";
import { C } from "@/theme/tokens";

/** Sits clear of the floating tab bar, with air between the two. */
const CTA_BOTTOM = 124;
const CTA_HEIGHT = 56;

export default function AutoEarn() {
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <AutoEarnScreen
        top={headerHeight}
        bottom={CTA_BOTTOM + CTA_HEIGHT + 24}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: CTA_BOTTOM,
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
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
