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
  // Shown above the dots by the screen itself. A wrong PIN used to raise a
  // toast, which put the verdict at the top of the screen and the shake at the
  // bottom; the screen now rejects the entry where the entry happened.
  const [pinError, setPinError] = useState<string | null>(null);
  const [biometricsLocked, setBiometricsLocked] = useState(false);
  const promptedOnMount = useRef(false);

  // Back through the entry gate, not straight to /home. "/" is the one place
  // that weighs membership as well as the lock, so a member whose subscription
  // lapsed while the app was closed meets the paywall on unlock instead of
  // discovering it by walking into a 403 three screens later.
  const done = useCallback(() => router.replace("/"), []);

  const runBiometrics = useCallback(async () => {
    setChecking(true);
    setPinError(null);
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
        setPinError(null);
        done();
        return true;
      }

      const used = attempts + 1;
      setAttempts(used);

      if (used >= MAX_PIN_ATTEMPTS) {
        toast.error("Too many attempts", "Sign in again to set a new PIN.");
        // `forget` — the one sign-out that must take the app lock with it.
        // Whoever is holding the phone does not know this PIN, so keeping it
        // would hand them back the same wall after they sign in, with no way
        // through it. They re-authenticate and set a new one.
        await signOut({ forget: true });
        router.replace("/signin");
        return false;
      }

      const left = MAX_PIN_ATTEMPTS - used;
      setPinError(`Wrong PIN · ${left} ${left === 1 ? "try" : "tries"} left`);
      // `false` is what makes the dots shake — the screen bumps its own nonce
      // on a rejected entry, so nothing here has to reach into the animation.
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
        error={pinError}
      />
    </SafeAreaView>
  );
}
