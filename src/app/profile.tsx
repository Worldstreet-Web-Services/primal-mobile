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

  /**
   * `forget` is the difference between the two actions on this screen, and it
   * is the whole fix for the flow: an ordinary sign-out leaves the PIN and the
   * biometric answer on the device, so signing back in lands in the app. Only
   * "Switch account" wipes them, because only then is the next person to sign
   * in someone else.
   */
  const leave = async (forget: boolean) => {
    setSigningOut(true);
    try {
      await signOut({ forget });
      toast.info(forget ? "Account switched" : "Signed out");
      // A forgotten device has nothing to return to, so it goes back to the
      // top of the funnel. A remembered one goes straight to sign-in.
      router.replace(forget ? "/welcome" : "/signin");
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
        onSignOut={() => void leave(false)}
        onSwitchAccount={() => void leave(true)}
        signingOut={signingOut}
        addresses={addresses}
      />
    </View>
  );
}
