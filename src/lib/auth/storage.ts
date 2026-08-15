/**
 * Every persisted auth secret goes through here — nothing auth-related touches
 * AsyncStorage or module state that survives a reload.
 *
 * SecureStore is the Keychain on iOS and Keystore-encrypted SharedPreferences
 * on Android. Values are capped well under the ~2KB practical iOS limit; a
 * Decane access token is a JWT, so it fits comfortably.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const KEYS = {
  accessToken: "primal.auth.access_token",
  expiresAt: "primal.auth.expires_at",
  pinHash: "primal.auth.pin_hash",
  pinSalt: "primal.auth.pin_salt",
  biometrics: "primal.auth.biometrics_enabled",
} as const;

/** Groups our entries under one service so a sign-out can't miss any. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "primal.auth",
  // The device must be unlocked to read a session, and the entry never rides a
  // backup to a new device — a stolen iCloud backup shouldn't carry a session.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function put(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

async function get(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key, OPTIONS);
}

async function drop(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, OPTIONS);
}

export interface StoredSession {
  accessToken: string;
  /** Epoch ms. Null when the auth surface didn't tell us. */
  expiresAt: number | null;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await put(KEYS.accessToken, session.accessToken);
  if (session.expiresAt) await put(KEYS.expiresAt, String(session.expiresAt));
  else await drop(KEYS.expiresAt);
}

export async function loadSession(): Promise<StoredSession | null> {
  const accessToken = await get(KEYS.accessToken);
  if (!accessToken) return null;
  const raw = await get(KEYS.expiresAt);
  const expiresAt = raw ? Number(raw) : null;
  return { accessToken, expiresAt: Number.isFinite(expiresAt) ? expiresAt : null };
}

export async function clearSession(): Promise<void> {
  await Promise.all([drop(KEYS.accessToken), drop(KEYS.expiresAt)]);
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
  await Promise.all([clearSession(), clearPin(), setBiometricsEnabled(false)]);
}
