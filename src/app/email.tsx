import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  describeAuthError,
  isCancellation,
  logAuthError,
} from "@/lib/auth/decane";
import EmailSignInScreen from "@/screens/EmailSignInScreen";

export default function EmailSignIn() {
  const { startEmailSignIn, verifyEmailCode } = useAuth();
  const toast = useToast();

  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async (address: string) => {
    setBusy(true);
    try {
      await startEmailSignIn(address);
      setEmail(address);
      setStage("code");
      toast.info("Code sent", `Check ${address}.`);
    } catch (error) {
      if (isCancellation(error)) return;
      logAuthError("email-signin", error);
      const { title, description } = describeAuthError(error);
      toast.error(title, description);
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (code: string) => {
    setBusy(true);
    try {
      await verifyEmailCode(email, code);
      toast.success("Signed in");
      // The gate routes onward — a returning user with a PIN lands on /home.
      router.replace("/");
    } catch (error) {
      if (isCancellation(error)) return;
      logAuthError("email-signin", error);
      const { title, description } = describeAuthError(error);
      toast.error(title, description);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Was a raw pre-rebrand hex; the ground is a token now, so this screen
    // moves with the rest of the app.
    <SafeAreaView className="flex-1 bg-canvas">
      <EmailSignInScreen
        stage={stage}
        email={email}
        busy={busy}
        onBack={() => (stage === "code" ? setStage("email") : router.back())}
        onSubmitEmail={sendCode}
        onSubmitCode={submitCode}
        onResend={() => sendCode(email)}
      />
    </SafeAreaView>
  );
}
