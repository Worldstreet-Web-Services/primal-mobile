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
    // Email is the one method that isn't a single handshake — it needs an
    // address and a code, so it gets its own screen rather than a modal
    // stapled onto this one.
    if (method === "email") {
      router.push("/email");
      return;
    }

    // Decane's built-in methods are google / email / kingschat, and the screen
    // offers exactly those three. Anything else is a caller bug, not a state
    // worth apologising for on screen.
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
