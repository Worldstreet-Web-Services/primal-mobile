import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import UnlockScreen from "@/screens/UnlockScreen";
import { C } from "@/theme/tokens";

/** Matches the app-lock convention: a few tries, then PIN only. */
const MAX_PIN_ATTEMPTS = 5;

/**
 * The Expo Go carve-out that used to live here has moved into
 * `lib/auth/biometrics.ts`, which is the module that actually knows: iOS Expo
 * Go carries no `NSFaceIDUsageDescription`, so reaching for Face ID there kills
 * the process. `getCapability()` now reports that device as having no usable
 * biometric at all, which closes the same hole for every caller instead of only
 * the one that remembered to check.
 */
export default function Unlock() {
  const {
    unlockWithPin,
    unlockWithBiometrics,
    signOut,
    capability,
    biometricsEnabled,
  } = useAuth();
  const toast = useToast();

  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [biometricsLocked, setBiometricsLocked] = useState(false);
  const promptedOnMount = useRef(false);

  // Back through the entry gate, not straight to /home. "/" is the one place
  // that weighs membership as well as the lock, so a member whose subscription
  // lapsed while the app was closed meets the paywall on unlock instead of
  // discovering it by walking into a 403 three screens later.
  const done = useCallback(() => router.replace("/"), []);

  const runBiometrics = useCallback(async () => {
    setChecking(true);
    try {
      const outcome = await unlockWithBiometrics();
      if (outcome.ok) {
        done();
        return;
      }
      if (outcome.reason === "lockout") {
        setBiometricsLocked(true);
        toast.warning("Biometrics locked", "Enter your PIN to unlock.");
        return;
      }
      // A cancel just means "let me use the PIN" — the keypad is already there.
      if (outcome.reason === "not_enrolled") setBiometricsLocked(true);
    } finally {
      setChecking(false);
    }
  }, [unlockWithBiometrics, done, toast]);

  /**
   * Offer biometrics immediately on landing, the way every banking app does —
   * the ref guards against the effect re-running and stacking OS prompts.
   *
   * Gated on the user's own preference as well as the device's capability. It
   * was gated on the device alone, which meant someone who answered "Maybe
   * later" during setup was met by a Face ID sheet on every launch anyway: the
   * onboarding step collected a decision the app then ignored. Turning it on is
   * `/passkey`, or Profile later.
   */
  useEffect(() => {
    if (promptedOnMount.current) return;
    if (!biometricsEnabled || !capability?.available) return;
    promptedOnMount.current = true;
    void runBiometrics();
  }, [biometricsEnabled, capability, runBiometrics]);

  const onPin = async (pin: string) => {
    setChecking(true);
    try {
      if (await unlockWithPin(pin)) {
        done();
        return true;
      }

      const used = attempts + 1;
      setAttempts(used);

      if (used >= MAX_PIN_ATTEMPTS) {
        toast.error("Too many attempts", "Sign in again to continue.");
        await signOut();
        router.replace("/welcome");
        return false;
      }

      toast.error(
        "Wrong PIN",
        `${MAX_PIN_ATTEMPTS - used} ${MAX_PIN_ATTEMPTS - used === 1 ? "try" : "tries"} left.`,
      );
      return false;
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.canvas }}>
      <UnlockScreen
        onPin={onPin}
        onBiometrics={runBiometrics}
        checking={checking}
        biometricsAvailable={
          biometricsEnabled && !!capability?.available && !biometricsLocked
        }
        biometricLabel={capability?.label ?? "Face ID"}
      />
    </SafeAreaView>
  );
}
