/**
 * App-owned auth state. Deliberately NOT the Decane session — the SDK persists
 * its own session and device key-share in the keystore (`persistSession`), and
 * duplicating the access token here would leave two copies to expire out of
 * step. `decane.getAccessToken()` is the single source for the token.
 *
 * What lives here is what Decane has no opinion about: the **transaction PIN**
 * that gates money-out (PRD §2) and the app-lock biometric preference.
 *
 * SecureStore is the Keychain on iOS and Keystore-encrypted SharedPreferences
 * on Android.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEYS = {
  pinHash: "paradigm.auth.pin_hash",
  pinSalt: "paradigm.auth.pin_salt",
  biometrics: "paradigm.auth.biometrics_enabled",
} as const;

/** Groups our entries under one service so a sign-out can't miss any. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.auth",
  // The device must be unlocked to read a session, and the entry never rides a
  // backup to a new device — a stolen iCloud backup shouldn't carry a session.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * SecureStore is iOS/Android only — on web the module exists but its methods
 * do not, so calling one throws `getValueWithKeyAsync is not a function` and
 * takes down whatever awaited it.
 *
 * Web is a **layout-preview target only**: Decane itself can't run there either
 * (native modules), so auth is always mocked. This shim keeps `expo start --web`
 * booting for UI work; it is `localStorage`, it is not secure, and nothing that
 * matters is ever stored through it on that platform.
 */
const isWeb = Platform.OS === "web";

const webStore = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private mode / storage disabled — dev-only path, ignore */
    }
  },
  remove(key: string): void {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* as above */
    }
  },
};

async function put(key: string, value: string): Promise<void> {
  if (isWeb) return webStore.set(key, value);
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

async function get(key: string): Promise<string | null> {
  if (isWeb) return webStore.get(key);
  return SecureStore.getItemAsync(key, OPTIONS);
}

async function drop(key: string): Promise<void> {
  if (isWeb) return webStore.remove(key);
  await SecureStore.deleteItemAsync(key, OPTIONS);
}

/**
 * The PIN is never stored, only a salted SHA-256 of it. This gates the local
 * app surface; the money-out PIN check that actually matters happens
 * server-side, where a stolen device can't replay it.
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function savePin(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  await put(KEYS.pinSalt, salt);
  await put(KEYS.pinHash, await hashPin(pin, salt));
}

export async function hasPin(): Promise<boolean> {
  return (await get(KEYS.pinHash)) !== null;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [hash, salt] = await Promise.all([get(KEYS.pinHash), get(KEYS.pinSalt)]);
  if (!hash || !salt) return false;
  return (await hashPin(pin, salt)) === hash;
}

export async function clearPin(): Promise<void> {
  await Promise.all([drop(KEYS.pinHash), drop(KEYS.pinSalt)]);
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  if (enabled) await put(KEYS.biometrics, "1");
  else await drop(KEYS.biometrics);
}

export async function isBiometricsEnabled(): Promise<boolean> {
  return (await get(KEYS.biometrics)) === "1";
}

/** Full local wipe — sign-out, and the recovery path when storage is corrupt. */
export async function clearAll(): Promise<void> {
  await Promise.all([clearPin(), setBiometricsEnabled(false)]);
}
