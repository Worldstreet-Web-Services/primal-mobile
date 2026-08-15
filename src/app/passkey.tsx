import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import PasskeyScreen from "@/screens/PasskeyScreen";

export default function Passkey() {
  const { enableBiometrics, skipBiometrics, capability } = useAuth();
  const toast = useToast();
  const [enabling, setEnabling] = useState(false);

  const finish = () => router.replace("/home");

  const onEnable = async () => {
    if (!capability?.available) {
      toast.warning(
        "No biometrics enrolled",
        "Add Face ID or a fingerprint in system settings, then enable it in Profile.",
      );
      return;
    }

    setEnabling(true);
    try {
      const outcome = await enableBiometrics();
      if (outcome.ok) {
        toast.success(`${capability.label} enabled`, "Use it to unlock Paradigm.");
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
    toast.info("Skipped for now", "Turn on biometric unlock any time in Profile.");
    finish();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0B0D" }}>
      <PasskeyScreen
        onEnable={onEnable}
        onSkip={onSkip}
        enabling={enabling}
        label={capability?.label ?? "Face ID"}
      />
    </SafeAreaView>
  );
}
