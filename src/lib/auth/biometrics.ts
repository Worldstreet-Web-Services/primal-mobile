/**
 * Device biometric unlock (Face ID / Touch ID / fingerprint).
 *
 * Worth being precise about what this is: Decane's *passkeys* are WebAuthn
 * credentials that live in the hosted auth surface and gate TEE signing. This
 * module is the separate, local thing the PRD also asks for — biometric unlock
 * of the app surface itself (§2, "Passkeys / biometric unlock for app access").
 * It authorises nothing on-chain.
 */

import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

/** No biometric APIs on web — see the note in storage.ts. */
const isWeb = Platform.OS === "web";

export type BiometricKind = "face" | "fingerprint" | "iris" | "none";

export interface BiometricCapability {
  /** Hardware present AND a biometric actually enrolled. */
  available: boolean;
  kind: BiometricKind;
  /** "Face ID", "Touch ID", "Fingerprint" — for button copy. */
  label: string;
}

export async function getCapability(): Promise<BiometricCapability> {
  if (isWeb) return { available: false, kind: "none", label: "Biometrics" };

  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  const available = hasHardware && isEnrolled;

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available, kind: "face", label: "Face ID" };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available, kind: "fingerprint", label: "Fingerprint" };
  }
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return { available, kind: "iris", label: "Iris" };
  }
  return { available: false, kind: "none", label: "Biometrics" };
}

export type BiometricOutcome =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "not_enrolled" | "lockout" | "failed" };

export async function authenticate(promptMessage: string): Promise<BiometricOutcome> {
  if (isWeb) return { ok: false, reason: "not_enrolled" };

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
