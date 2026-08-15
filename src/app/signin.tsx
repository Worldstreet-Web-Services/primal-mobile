import { router } from "expo-router";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  describeAuthError,
  isCancellation,
  logAuthError,
  usingMockAuth,
} from "@/lib/auth/decane";
import SignInScreen from "@/screens/SignInScreen";

export default function SignIn() {
  const { signIn, pending, creatingWallet } = useAuth();
  const toast = useToast();

  const onSignIn = async (method: string) => {
    // Decane's built-in methods are google / email / kingschat. Apple would
    // have to come through the generic external-provider path with an Apple
    // identity token, which needs a provider registered in the dashboard —
    // not wired yet, so it is surfaced honestly rather than failing opaquely.
    if (method === "apple") {
      toast.info(
        "Apple sign-in isn't ready",
        "Use KingsChat or Google for now.",
      );
      return;
    }

    if (method !== "google" && method !== "kingschat") return;

    try {
      await signIn(method);
      toast.success(
        "Signed in",
        usingMockAuth ? "Mock session — Decane isn't configured." : undefined,
      );
      // The gate at "/" routes onward by onboarding step.
      router.replace("/");
    } catch (error) {
      // A cancel is a deliberate user action, not a failure worth alarming over.
      if (isCancellation(error)) return;
      // Staged failures already logged inside decane.signIn; this catches
      // anything thrown after it (session adoption, storage).
      logAuthError("signin.onSignIn", error);
      const { title, description } = describeAuthError(error);
      toast.error(title, description);
    }
  };

  return (
    <SignInScreen
      onSignIn={onSignIn}
      pending={pending}
      creatingWallet={creatingWallet}
    />
  );
}
