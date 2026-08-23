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
 * **The order is sign in → app lock → membership → welcome aboard**, and it is
 * decided here, in one file, because it is the only place that can see all
 * three answers at once.
 *
 * The app lock comes first because it is the only step that protects the phone
 * in front of you. A PIN and a biometric unlock cost nothing, take a moment,
 * and are what stand between a borrowed handset and everything behind it — so
 * they are asked for while the person is already setting things up, not left
 * until after a payment. (This is a reversal: membership used to be gated ahead
 * of onboarding, on the reasoning that an app lock for an unpaid account is
 * furnishing a room you have not rented. The room is the phone, and it is
 * already theirs.)
 *
 * Membership then gates everything past it, and it is a real gate rather than a
 * thing discovered later by walking into a 403.
 *
 * This is the ONLY route into /pin and /passkey, which is what makes the whole
 * sequence enforceable in one place.
 */
export default function Index() {
  const [finished, setFinished] = useState(false);
  const { status, step, primal, creatingWallet, returning } = useAuth();

  if (!finished || status === "loading") {
    return <Splash animated onDone={() => setFinished(true)} />;
  }

  // The pitch is for people who have never been here. A device that still
  // carries an app lock has been set up already — its owner signed out, they
  // did not uninstall — so they get the sign-in screen, not the sales page and
  // a second tap to reach the same place.
  if (status === "signedOut") {
    return <Redirect href={returning ? SIGN_IN_ROUTE : "/welcome"} />;
  }
  if (status === "locked") return <Redirect href="/unlock" />;

  // The app lock, before anything the gateway has an opinion about. Both steps
  // are local — a PIN hashed into the keychain, a biometric preference — so
  // neither waits on the SIWE handshake that is running behind this screen, and
  // by the time they are done the entitlement answer has usually landed.
  if (status === "onboarding") {
    return <Redirect href={step === "passkey" ? "/passkey" : "/pin"} />;
  }

  // Signed in and locked down. Whether KashPlus is satisfied is a separate
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
          label={creatingWallet ? "Creating your wallet" : "Setting up KashPlus"}
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

  return <Redirect href="/home" />;
}
