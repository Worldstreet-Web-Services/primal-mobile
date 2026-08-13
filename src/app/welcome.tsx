import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import WelcomeScreen from "@/screens/WelcomeScreen";

export default function Welcome() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      {/* Auth is the other workstream (Decane + KingsChat); every method
          walks the same onboarding for now. */}
      <WelcomeScreen onLogin={() => router.push("/pin")} />
    </SafeAreaView>
  );
}
