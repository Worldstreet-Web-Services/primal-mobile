import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import ProfileScreen from "@/screens/ProfileScreen";
import { C } from "@/theme/tokens";

/** Clears the floating tab bar, matching the other tab roots. */
const TAB_BAR_CLEARANCE = 110;

// Tab root, so there is nothing to go back to — the screen renders its own
// plain title instead of a back header.
export default function Profile() {
  const { signOut } = useAuth();
  const toast = useToast();
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
        bottom={TAB_BAR_CLEARANCE}
        onSignOut={onSignOut}
        signingOut={signingOut}
      />
    </View>
  );
}
