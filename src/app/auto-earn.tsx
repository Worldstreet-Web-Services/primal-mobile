import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AboutAutoEarn } from "@/components/earn";
import { InfoIcon } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { CircleAction } from "@/components/ui";
import AutoEarnScreen from "@/screens/AutoEarnScreen";
import { C } from "@/theme/tokens";

export default function AutoEarn() {
  const insets = useSafeAreaInsets();
  const [about, setAbout] = useState(false);

  return (
    <View className="flex-1 bg-canvas">
      {/* In flow, not floating — the scroll starts beneath it, so the screen
          needs no head space of its own. */}
      <PageHeader
        title="Auto Earn"
        onBack={() => router.back()}
        right={
          <CircleAction
            size={36}
            onPress={() => setAbout(true)}
            accessibilityLabel="About Auto Earn"
            className="border-transparent"
          >
            <InfoIcon size={19} color={C.silver} />
          </CircleAction>
        }
      />

      <AutoEarnScreen
        bottom={Math.max(insets.bottom, 12)}
        onProceed={() => router.back()}
        onCancel={() => router.back()}
      />

      <AboutAutoEarn visible={about} onClose={() => setAbout(false)} />
    </View>
  );
}
