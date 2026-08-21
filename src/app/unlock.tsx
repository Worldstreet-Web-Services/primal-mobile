import Constants, { ExecutionEnvironment } from "expo-constants";
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
 * Expo Go runs its own binary, so the `faceIDPermission` we set on the
 * `expo-local-authentication` config plugin in app.json is never applied —
 * config plugins only take effect in a prebuild. iOS terminates a process that
 * reaches for Face ID with no `NSFaceIDUsageDescription`, and it does so
 * without a JS error or a Metro log line, which reads as "the app loads to 100%
 * then closes". Firing that at mount, before the user has touched anything,
 * makes the whole app unopenable in Expo Go.
 *
 * So the automatic prompt is dev-build only. The button still offers Face ID in
 * Expo Go for anyone whose client does carry the key, and the PIN keypad is
 * already on screen as the fallback either way.
 */
const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function Unlock() {
  const { unlockWithPin, unlockWithBiometrics, signOut, capability } = useAuth();
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

  // Offer biometrics immediately on landing, the way every banking app does —
  // the ref guards against the effect re-running and stacking OS prompts.
  useEffect(() => {
    if (IS_EXPO_GO) return; // see IS_EXPO_GO — an unguarded prompt kills the app
    if (promptedOnMount.current || !capability?.available) return;
    promptedOnMount.current = true;
    void runBiometrics();
  }, [capability, runBiometrics]);

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
        biometricsAvailable={!!capability?.available && !biometricsLocked}
        biometricLabel={capability?.label ?? "Face ID"}
      />
    </SafeAreaView>
  );
}
