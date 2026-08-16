import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import ProfileScreen from "@/screens/ProfileScreen";
import { C } from "@/theme/tokens";

// Pushed route now that the tab bar is gone, so the screen keeps its own plain
// title and the default tail space — nothing floats over the content.
export default function Profile() {
  const { signOut, addresses } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.info("Signed out");
      router.replace("/welcome");
    } catch {
      toast.error("Couldn't sign out", "Try again.");
      setSigningOut(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <ProfileScreen
        top={insets.top + 8}
        onBack={() => router.back()}
        onSignOut={onSignOut}
        signingOut={signingOut}
        addresses={addresses}
      />
    </View>
  );
}
