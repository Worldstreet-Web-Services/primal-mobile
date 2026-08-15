import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { AuthError, describeAuthError, usingMockAuth } from "@/lib/auth/decane";
import type { AuthMethod } from "@/lib/auth/decane";
import WelcomeScreen from "@/screens/WelcomeScreen";

export default function Welcome() {
  const { signIn, pending } = useAuth();
  const toast = useToast();

  const onLogin = async (method: string) => {
    // KingsChat needs the bridge issuer (PRD §F1) and isn't wired yet; only
    // Decane's built-in methods are live.
    if (method !== "google" && method !== "email") {
      toast.info(
        "KingsChat isn't ready yet",
        "Sign in with Google or email while the bridge is built.",
      );
      return;
    }

    try {
      await signIn(method as AuthMethod);
      toast.success(
        "Signed in",
        usingMockAuth ? "Mock session — no auth surface configured." : undefined,
      );
      // The gate routes onward; a returning user with a PIN lands on /home.
      router.replace("/");
    } catch (error) {
      // A cancel is a deliberate user action, not a failure worth alarming over.
      if (error instanceof AuthError && error.reason === "cancelled") return;
      const { title, description } = describeAuthError(error);
      toast.error(title, description);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <WelcomeScreen onLogin={onLogin} pending={pending} />
    </SafeAreaView>
  );
}
