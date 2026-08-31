import { router } from "expo-router";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import PasskeyScreen from "@/screens/PasskeyScreen";

export default function Passkey() {
  const { enableBiometrics, skipBiometrics, capability, refreshCapability } =
    useAuth();
  const toast = useToast();
  const [enabling, setEnabling] = useState(false);

  // Through "/" rather than at /home directly: onboarding's last step should
  // hand back to the one router that decides where a signed-in, paid, unlocked
  // account belongs, instead of asserting the answer itself.
  const finish = () => router.replace("/");

  const onEnable = async () => {
    setEnabling(true);
    try {
      /**
       * Ask the device NOW, rather than trusting the answer this screen
       * rendered with.
       *
       * Enrolling a face is something you leave the app to do, and the obvious
       * order of events is to open this step, discover you have not enrolled,
       * go and enrol, come back and tap again. Refusing on the capability read
       * at mount makes that sequence impossible: the toast says "add a face in
       * your device settings", and doing exactly that changes nothing, because
       * the only thing standing in the way is a stale boolean. A tap is a
       * question the user is asking the device, so it is put to the device.
       */
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
        toast.success(`${current.label} enabled`, "Use it to unlock KashPlus.");
        finish();
        return;
      }
      if (outcome.reason === "cancelled") return; // user backed out; stay put
      if (outcome.reason === "lockout") {
        toast.error("Too many attempts", "Unlock your device, then try again.");
        return;
      }
      toast.error(
        "Couldn't enable biometrics",
        "You can turn it on later in Profile.",
      );
    } finally {
      setEnabling(false);
    }
  };

  const onSkip = async () => {
    await skipBiometrics();
    // The toggle this points at is real now — Settings › Security carries the
    // same switch, writing the same preference — so the copy could name it.
    // It still doesn't: this is the last step of onboarding, and a person who
    // just said "not now" does not need directions to the thing they declined.
    toast.info("Skipped", "Your PIN unlocks KashPlus.");
    finish();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <PasskeyScreen
        onEnable={onEnable}
        onSkip={onSkip}
        enabling={enabling}
        label={capability?.label ?? "Face ID"}
      />
    </SafeAreaView>
  );
}
