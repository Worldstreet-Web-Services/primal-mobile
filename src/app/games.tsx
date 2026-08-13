import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import GamesSpaceScreen from "@/screens/GamesSpaceScreen";

export default function Games() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <GamesSpaceScreen
        onBack={() => router.back()}
        onOpenGame={(slug) => {
          if (slug === "last-man") router.push("/lastman");
        }}
      />
    </SafeAreaView>
  );
}
