import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { BrandLoading } from "@/components/BrandLoading";
import { Splash } from "@/components/Splash";
import { useAuth } from "@/lib/auth/AuthContext";
import { isEntitled } from "@/lib/gateway/types";
import { announceDevMode, skipPaywall } from "@/lib/devMode";
import { SIGN_IN_ROUTE, SUBSCRIPTION_ROUTE } from "@/lib/routes";
import { C } from "@/theme/tokens";

/**
 * Entry: the animated splash plays once, then the restored session decides
 * where the user lands. The native splash (expo-splash-screen) covers font
 * loading before this mounts, so the mark appears to carry straight through
 * from launch.
 *
 * The splash doubles as the session-restore cover — it holds while the SDK
 * resolves, so a returning user never sees the welcome pitch flash past on the
 * way to being redirected.
 *
 * **Membership is gated BEFORE onboarding.** Paradigm costs USD 1,000 a month,
 * so the paywall is the door, not a thing discovered later by walking into a
 * 403: sign in, then pay, and only then set a PIN. Setting up an app lock for
 * an account that has not been paid for is asking someone to furnish a room
 * they have not rented.
 *
 * This is the ONLY route into /pin and /passkey, which is what makes the gate
 * enforceable in one place.
 */
export default function Index() {
  const [finished, setFinished] = useState(false);
  const { status, step, primal, creatingWallet } = useAuth();

  if (!finished || status === "loading") {
    return <Splash animated onDone={() => setFinished(true)} />;
  }

  if (status === "signedOut") return <Redirect href="/welcome" />;
  if (status === "locked") return <Redirect href="/unlock" />;

  // Signed in — Decane is satisfied. Whether Paradigm is, is a separate
  // question, and it belongs to the gateway.
  if (primal.state === "session_expired") return <Redirect href={SIGN_IN_ROUTE} />;

  // The SIWE handshake and entitlement probe are still in flight. Hold rather
  // than guess: a paying member must never see a paywall flash past on the way
  // to their own account.
  //
  // This is the app's longest honest wait and it earns a real cover. Straight
  // after a first sign-in it is doing genuine work — Decane splits the key into
  // its Shamir shares (seconds, not milliseconds), then the wallet signs a SIWE
  // challenge and the gateway is asked twice. A bare splash here reads as a
  // hang; the crown with the mark falling into place reads as progress, which
  // is what it is.
  if (primal.state === "unknown" && !primal.error) {
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <BrandLoading
          label={creatingWallet ? "Creating your wallet" : "Setting up Paradigm"}
        />
      </View>
    );
  }

  // A determinate "not entitled" is the paywall. An INDETERMINATE one is not:
  // if the gateway could not be reached (`primal.error`), showing a member a
  // sell page because their train went into a tunnel is the worse mistake. They
  // go on to the app, where every money route still refuses them on its own 403
  // — the client gate is convenience, the backend gate is the security control,
  // and the contract is explicit that it must stay that way.
  if (primal.state !== "unknown" && !isEntitled(primal.state)) {
    // Dev builds may walk past this (EXPO_PUBLIC_DEV_SKIP_PAYWALL) so the
    // wallet-side surfaces stay testable while the paid path is being proven.
    // It only moves this redirect — the gateway still refuses every LinkPay
    // request, so nothing behind the gate becomes usable, and `announceDevMode`
    // says so in the log rather than letting the 403s read as broken code.
    announceDevMode();
    if (!skipPaywall) return <Redirect href={SUBSCRIPTION_ROUTE} />;
  }

  if (status === "onboarding") {
    return <Redirect href={step === "passkey" ? "/passkey" : "/pin"} />;
  }
  return <Redirect href="/home" />;
}
