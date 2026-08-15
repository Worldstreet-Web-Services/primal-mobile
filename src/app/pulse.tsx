import { useState } from "react";
import { View } from "react-native";

import { PageHeader } from "@/components/PageHeader";
import PulseScreen from "@/screens/PulseScreen";
import { C } from "@/theme/tokens";
import { router } from "expo-router";

export default function Pulse() {
  // The header floats over the scroll view, so the content needs to start
  // below it — measured, since the safe area moves it per device.
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <PageHeader title="Notifications" onBack={() => router.back()} />
      {/* Wordmark only, matching Home — the screen's own Display carries the tab name. */}

      <PulseScreen />
    </View>
  );
}
