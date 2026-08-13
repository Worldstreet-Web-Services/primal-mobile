import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import ProfileScreen from "@/screens/ProfileScreen";

export default function Profile() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <ProfileScreen onBack={() => router.back()} />
    </SafeAreaView>
  );
}
