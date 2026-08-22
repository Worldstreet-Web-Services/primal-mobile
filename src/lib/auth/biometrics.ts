/**
 * Device biometric unlock (Face ID / Touch ID / fingerprint).
 *
 * Worth being precise about what this is: Decane's *passkeys* are WebAuthn
 * credentials that live in the hosted auth surface and gate TEE signing. This
 * module is the separate, local thing the PRD also asks for — biometric unlock
 * of the app surface itself (§2, "Passkeys / biometric unlock for app access").
 * It authorises nothing on-chain.
 *
 * It also carries a `__DEV__` stand-in, for the same reason the wallet and the
 * gateway have one: on a simulator with nothing enrolled, the setup step could
 * only ever be skipped, and the lock screen could only ever show a keypad. The
 * stand-in makes both real enough to walk. Everything it touches is marked
 * `placeholder: true` so no screen can present it as the genuine article.
 */

import Constants, { ExecutionEnvironment } from "expo-constants";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

import { placeholderAuth } from "@/lib/devMode";

/** No biometric APIs on web — see the note in storage.ts. */
const isWeb = Platform.OS === "web";

/**
 * iOS Expo Go cannot perform a real biometric check, and finding out costs the
 * whole process.
 *
 * The `faceIDPermission` we set on the `expo-local-authentication` config
 * plugin only lands in a prebuild, so Expo Go's own binary carries no
 * `NSFaceIDUsageDescription` — and iOS terminates a process that reaches for
 * Face ID without one, with no JS error and no Metro log line. `unlock.tsx`
 * already refuses to auto-prompt for that reason; this moves the knowledge into
 * the module that owns it, so every caller is covered rather than the one that
 * remembered.
 */
const IS_EXPO_GO =
  Platform.OS === "ios" &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export type BiometricKind = "face" | "fingerprint" | "iris" | "none";

export interface BiometricCapability {
  /** This device can be asked for a biometric — by hardware, or by stand-in. */
  available: boolean;
  kind: BiometricKind;
  /** "Face ID", "Touch ID", "Fingerprint" — for button copy. */
  label: string;
  /**
   * `available` is satisfied by the DEV stand-in rather than by hardware.
   *
   * Surfaces must say so. A simulator that answers "yes" to a Face ID prompt
   * nobody saw is useful for walking the flow and dishonest to leave unlabelled
   * — the one thing a person must not come away believing is that this phone is
   * locked when it is not.
   */
  placeholder: boolean;
}

/** What the hardware actually offers, before any stand-in is considered. */
async function realCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  // Enrolled hardware we are not allowed to touch is hardware we do not have.
  const available = hasHardware && isEnrolled && !IS_EXPO_GO;

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available, kind: "face", label: "Face ID", placeholder: false };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available, kind: "fingerprint", label: "Fingerprint", placeholder: false };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { available, kind: "iris", label: "Iris", placeholder: false };
  }
  return { available: false, kind: "none", label: "Biometrics", placeholder: false };
}

/**
 * The stand-in, for a dev build on a device that cannot do the real thing.
 *
 * Setting up biometric unlock is a step in onboarding, and on a simulator with
 * nothing enrolled — or in Expo Go — the real check is unavailable, so the step
 * could only ever be skipped. A step that can only be skipped is a step that
 * never gets tested. This makes it completable, and `placeholder: true` makes
 * every surface that shows it admit what it is.
 *
 * `__DEV__` only, via `placeholderAuth`. It cannot exist in a release build.
 */
const PLACEHOLDER_CAPABILITY: BiometricCapability = {
  available: true,
  kind: "face",
  label: "Face ID",
  placeholder: true,
};

export async function getCapability(): Promise<BiometricCapability> {
  if (isWeb) {
    return placeholderAuth
      ? PLACEHOLDER_CAPABILITY
      : { available: false, kind: "none", label: "Biometrics", placeholder: false };
  }

  const real = await realCapability();
  if (real.available || !placeholderAuth) return real;

  // Keep whatever the hardware is CALLED when it told us — a simulator with no
  // enrolled face still reports facial recognition, and "Enable Face ID" on a
  // device whose button says Fingerprint is a worse stand-in than it needs to be.
  return {
    ...PLACEHOLDER_CAPABILITY,
    kind: real.kind === "none" ? PLACEHOLDER_CAPABILITY.kind : real.kind,
    label: real.kind === "none" ? PLACEHOLDER_CAPABILITY.label : real.label,
  };
}

export type BiometricOutcome =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "not_enrolled" | "lockout" | "failed" };

let announced = false;

/**
 * The stand-in's answer: yes, after a beat.
 *
 * Deliberately never refuses. There is no face to fail, and a random rejection
 * would only teach a developer to distrust a screen that is working.
 */
async function placeholderAuthenticate(): Promise<BiometricOutcome> {
  if (!announced) {
    announced = true;
    console.warn(
      "[dev] PLACEHOLDER BIOMETRICS — this device cannot perform a real " +
        "biometric check, so the prompt is simulated and always succeeds. The " +
        "app lock is NOT protecting this build. Never ship this.",
    );
  }
  // Roughly what a Face ID sheet costs, so the screens' pending states show.
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { ok: true };
}

export async function authenticate(promptMessage: string): Promise<BiometricOutcome> {
  // The stand-in is reached only when the real check is genuinely unavailable,
  // which is the same test `getCapability` published. Asking the hardware first
  // means a device that CAN do this always does.
  if (isWeb || IS_EXPO_GO || !(await realCapability()).available) {
    return placeholderAuth
      ? placeholderAuthenticate()
      : { ok: false, reason: "not_enrolled" };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    // The PIN keypad is already on screen as the fallback, so the OS passcode
    // sheet would be a second, redundant fallback stacked on ours.
    disableDeviceFallback: true,
    cancelLabel: "Use PIN",
  });

  if (result.success) return { ok: true };

  switch (result.error) {
    case "user_cancel":
    case "app_cancel":
    case "system_cancel":
    case "user_fallback":
      return { ok: false, reason: "cancelled" };
    case "not_enrolled":
    case "not_available":
    case "passcode_not_set":
      return { ok: false, reason: "not_enrolled" };
    case "lockout":
      return { ok: false, reason: "lockout" };
    default:
      return { ok: false, reason: "failed" };
  }
}
