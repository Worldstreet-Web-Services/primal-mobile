import Constants from "expo-constants";
import { router } from "expo-router";
import { useCallback, useState } from "react";

import { useBalanceMasked } from "@/components/home";
import { useToast } from "@/components/Toast";
import { user } from "@/data/mock";
import { LOCK_AFTER_MS } from "@/hooks/useInactive";
import { useAuth } from "@/lib/auth/AuthContext";
import type { PrimalAppState } from "@/lib/gateway/types";
import { SUBSCRIPTION_ROUTE } from "@/lib/routes";
import SettingsScreen, { type PlanBadge } from "@/screens/SettingsScreen";
import { useThemePreference } from "@/theme/preference";

/**
 * What the subscription row says, read off the app's one entitlement authority.
 *
 * `primal.state` is backend-derived and never guessed locally — the same rule
 * the home screen's figures follow. Every branch below is a state the gateway
 * can genuinely put a session in, and each says which one it is rather than
 * collapsing the lot into "Free".
 */
function planOf(state: PrimalAppState): PlanBadge {
  switch (state) {
    case "active":
      return {
        label: "Active",
        tone: "on",
        note: "Renews automatically",
      };
    case "cancel_at_period_end":
      return {
        label: "Ending",
        tone: "warn",
        note: "Runs to the end of this period, then stops",
      };
    case "payment_pending":
      return {
        label: "Pending",
        tone: "warn",
        note: "Your payment is on its way",
      };
    case "entitlement_syncing":
      return {
        label: "Syncing",
        tone: "warn",
        note: "Your payment is in, switching it on",
      };
    case "expired":
      return {
        label: "Expired",
        tone: "off",
        note: "Ended — resubscribe to reopen naira",
      };
    case "authenticated_unpaid":
      return {
        label: "Free",
        tone: "off",
        note: "Naira, money-out and bills need a subscription",
      };
    case "anonymous":
    case "session_expired":
      return {
        label: "Signed out",
        tone: "off",
        note: "Sign in again to see your plan",
      };
    default:
      // `unknown` — the pre-decision state at launch, before the first probe
      // lands. It is not "Free", and saying so would be a paywall we invented.
      return {
        label: "Checking",
        tone: "off",
        note: "Checking…",
      };
  }
}

/** "2 minutes" from the constant the lock actually enforces. */
function lockAfterLabel(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  return minutes === 1 ? "a minute" : `${minutes} minutes`;
}

export default function Settings() {
  const {
    primal,
    capability,
    biometricsEnabled,
    enableBiometrics,
    skipBiometrics,
    refreshCapability,
    lock,
    signOut,
  } = useAuth();
  const toast = useToast();
  const [masked, toggleMasked] = useBalanceMasked();
  const [theme, setTheme] = useThemePreference();
  const [bioBusy, setBioBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const label = capability?.label ?? "Face ID";

  /**
   * The biometric switch.
   *
   * Turning it ON asks the DEVICE what it can do at the moment of the tap, not
   * at the moment this screen rendered — enrolling a face is something you
   * leave the app to do, and refusing on a stale boolean makes "go and enrol,
   * come back and try again" impossible. `/passkey` settled this already; this
   * is the same tap and the same reasoning.
   */
  const onToggleBiometrics = useCallback(
    (next: boolean) => {
      if (bioBusy) return;
      void (async () => {
        setBioBusy(true);
        try {
          if (!next) {
            await skipBiometrics();
            toast.info(`${label} unlock off`, "Your PIN unlocks KashPlus.");
            return;
          }

          const current = await refreshCapability();
          if (!current.available) {
            toast.warning(
              "No biometrics enrolled",
              "Add Face ID or a fingerprint in your device settings, then try again.",
            );
            return;
          }

          const outcome = await enableBiometrics();
          if (outcome.ok) {
            toast.success(
              `${current.label} enabled`,
              "Use it to unlock KashPlus.",
            );
            return;
          }
          // Backing out of the OS prompt is an answer, not a failure — the
          // switch simply stays where it was and nothing is said about it.
          if (outcome.reason === "cancelled") return;
          if (outcome.reason === "lockout") {
            toast.error("Too many attempts", "Unlock your device, then try again.");
            return;
          }
          toast.error(
            "Couldn't turn it on",
            "Your PIN still unlocks KashPlus.",
          );
        } finally {
          setBioBusy(false);
        }
      })();
    },
    [
      bioBusy,
      enableBiometrics,
      label,
      refreshCapability,
      skipBiometrics,
      toast,
    ],
  );

  /**
   * Close the app lock without ending the session. `LockGate` is what sends a
   * locked app to `/unlock`, so there is deliberately no navigation here — this
   * flips the state and the gate does the routing, exactly as an idle timeout
   * does.
   */
  const onLockNow = useCallback(() => {
    lock();
  }, [lock]);

  /** Same two doors as Profile: sign out keeps the device's lock, switch wipes it. */
  const leave = useCallback(
    (forget: boolean) => {
      void (async () => {
        setSigningOut(true);
        try {
          await signOut({ forget });
          toast.info(forget ? "Account switched" : "Signed out");
          router.replace(forget ? "/welcome" : "/signin");
        } catch {
          toast.error("Couldn't sign out", "Try again.");
          setSigningOut(false);
        }
      })();
    },
    [signOut, toast],
  );

  return (
    <SettingsScreen
      name={user.name}
      tag={user.tag}
      avatar={require("@/assets/images/avatar.png")}
      initial={user.initial}
      plan={planOf(primal.state)}
      onOpenProfile={() => router.push("/profile")}
      onOpenSubscription={() => router.push(SUBSCRIPTION_ROUTE)}
      onOpenVerification={() => router.push("/kyc")}
      biometrics={{
        label,
        // Until the first capability probe lands, `capability` is null. Treat
        // that as "not yet known" rather than "not available": disabling the
        // row on a null would grey out the control on a phone that has Face ID.
        available: capability?.available ?? true,
        enabled: biometricsEnabled,
        busy: bioBusy,
        onToggle: onToggleBiometrics,
      }}
      onOpenPin={() => router.push("/pin")}
      onLockNow={onLockNow}
      lockAfterLabel={lockAfterLabel(LOCK_AFTER_MS)}
      masked={masked}
      onToggleMasked={toggleMasked}
      theme={theme}
      onChangeTheme={setTheme}
      version={`v${Constants.expoConfig?.version ?? "1.0.0"}`}
      signingOut={signingOut}
      onSignOut={() => leave(false)}
      onSwitchAccount={() => leave(true)}
    />
  );
}
