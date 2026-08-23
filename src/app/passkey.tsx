import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import PasskeyScreen from "@/screens/PasskeyScreen";
import { C } from "@/theme/tokens";

export default function Passkey() {
  const { enableBiometrics, skipBiometrics, capability } = useAuth();
  const toast = useToast();
  const [enabling, setEnabling] = useState(false);

  // Through "/" rather than at /home directly: onboarding's last step should
  // hand back to the one router that decides where a signed-in, paid, unlocked
  // account belongs, instead of asserting the answer itself.
  const finish = () => router.replace("/");

  const onEnable = async () => {
    // Only reachable on a real device with nothing enrolled: in a dev build the
    // stand-in reports itself as available, so the step can be completed rather
    // than only skipped.
    if (!capability?.available) {
      toast.warning(
        "No biometrics enrolled",
        "Add Face ID or a fingerprint in your device settings, then come back.",
      );
      return;
    }

    setEnabling(true);
    try {
      const outcome = await enableBiometrics();
      if (outcome.ok) {
        toast.success(
          `${capability.label} enabled`,
          capability.placeholder
            ? "Simulated — this build has no real biometric to check."
            : "Use it to unlock KashPlus.",
        );
        finish();
        return;
      }
      if (outcome.reason === "cancelled") return; // user backed out; stay put
      if (outcome.reason === "lockout") {
        toast.error("Too many attempts", "Unlock your device, then try again.");
        return;
      }
      toast.error("Couldn't enable biometrics", "You can turn it on later in Profile.");
    } finally {
      setEnabling(false);
    }
  };

  const onSkip = async () => {
    await skipBiometrics();
    // Deliberately does not promise a Profile toggle: there is no wired control
    // there yet, and the lock screen now honours this choice, so "any time in
    // Profile" would be the one instruction the app cannot carry out.
    toast.info("Skipped", "Your PIN unlocks KashPlus.");
    finish();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <PasskeyScreen
        onEnable={onEnable}
        onSkip={onSkip}
        enabling={enabling}
        label={capability?.label ?? "Face ID"}
        placeholder={capability?.placeholder ?? false}
      />
    </SafeAreaView>
  );
}
