import { Redirect } from "expo-router";
import { useState } from "react";

import { Splash } from "@/components/Splash";
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Entry: the animated splash plays once, then the restored session decides
 * where the user lands. The native splash (expo-splash-screen) covers font
 * loading before this mounts, so the mark appears to carry straight through
 * from launch.
 *
 * The splash doubles as the session-restore cover — it holds while the SDK
 * resolves, so a returning user never sees the welcome pitch flash past on the
 * way to being redirected.
 */
export default function Index() {
  const [finished, setFinished] = useState(false);
  const { status, step } = useAuth();

  if (!finished || status === "loading") {
    return <Splash animated onDone={() => setFinished(true)} />;
  }

  if (status === "signedOut") return <Redirect href="/welcome" />;
  if (status === "locked") return <Redirect href="/unlock" />;
  if (status === "onboarding") {
    return <Redirect href={step === "passkey" ? "/passkey" : "/pin"} />;
  }
  return <Redirect href="/home" />;
}
