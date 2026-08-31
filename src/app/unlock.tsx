import Constants, { ExecutionEnvironment } from "expo-constants";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import UnlockScreen from "@/screens/UnlockScreen";

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
   * Raise the prompt immediately on landing, the way every banking app does —
   * the ref guards against the effect re-running and stacking OS prompts.
   *
   * THIS is what the stored preference governs, and only this: a prompt the app
   * raises without being asked. Someone who answered "Maybe later" during setup
   * was met by a Face ID sheet on every launch anyway, which made the onboarding
   * step a question whose answer was discarded.
   *
   * The BUTTON is a separate matter and is not gated on the preference — see
   * `biometricsAvailable` below. Whether the device can do this is the device's
   * answer; whether to ask unprompted is the user's.
   */
  useEffect(() => {
    if (IS_EXPO_GO) return; // see IS_EXPO_GO — an unguarded prompt kills the app
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
    <SafeAreaView className="flex-1 bg-canvas">
      {/* No transition, in either direction.

          A lock is not a place the app travels to. Every other route here is
          somewhere the user asked to go, and a slide says so; this one appears
          because time ran out or because the app came back from the background,
          and animating it makes the lock look like a screen sliding over the
          content rather than the content being taken away. Worse on the way in
          from a timeout: the previous screen stays on view, mid-slide, for the
          length of the transition — which is exactly the content the lock
          exists to cover. */}
      <Stack.Screen options={{ animation: "none" }} />
      <UnlockScreen
        onPin={onPin}
        onBiometrics={runBiometrics}
        checking={checking}
        // The device's answer, not the stored preference. "Maybe later" means
        // "do not ask me on sight" — it does not mean the option should vanish
        // from the lock screen, and hiding it there leaves someone who changed
        // their mind with no way to reach a working Face ID but a reinstall.
        // Tapping it is itself the request, so nothing is raised unasked.
        biometricsAvailable={!!capability?.available && !biometricsLocked}
        biometricLabel={capability?.label ?? "Face ID"}
        error={pinError}
      />
    </SafeAreaView>
  );
}
