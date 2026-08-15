import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import { describeAuthError, isCancellation, usingMockAuth } from "@/lib/auth/decane";
import WelcomeScreen from "@/screens/WelcomeScreen";

export default function Welcome() {
  const { signIn, pending, creatingWallet } = useAuth();
  const toast = useToast();

  const onLogin = async (method: string) => {
    // Email is two-step (address, then a 6-digit code), so it gets its own
    // screen rather than resolving inline like the redirect-based methods.
    if (method === "email") {
      router.push("/email");
      return;
    }

    if (method !== "google" && method !== "kingschat") return;

    try {
      await signIn(method);
      toast.success(
        "Signed in",
        usingMockAuth ? "Mock session — Decane isn't configured." : undefined,
      );
      router.replace("/");
    } catch (error) {
      // A cancel is a deliberate user action, not a failure worth alarming over.
      if (isCancellation(error)) return;
      const { title, description } = describeAuthError(error);
      toast.error(title, description);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <WelcomeScreen
        onLogin={onLogin}
        pending={pending}
        creatingWallet={creatingWallet}
      />
    </SafeAreaView>
  );
}
