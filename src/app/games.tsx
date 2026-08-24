import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import GamesSpaceScreen from "@/screens/GamesSpaceScreen";

export default function Games() {
  const [headerHeight, setHeaderHeight] = useState(0);

  return (
    <View className="flex-1 bg-canvas">
      <GamesSpaceScreen
        top={headerHeight}
        onOpenGame={(slug) => {
          if (slug === "last-man") router.push("/lastman");
        }}
      />
      <NavHeader
        wordmark="GAMES$"
        tagline="POWERED BY ARK"
        direction="column"
        unread
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
