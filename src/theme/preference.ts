/**
 * Which palette the app paints in, and where that choice is kept.
 *
 * `src/app/_layout.tsx` sets dark at module scope so the first frame is dark on
 * every launch — an effect would let one light frame through on a handset set
 * to light. This module is the part that comes after: it reads the stored
 * choice and applies it, and it is what the Appearance control in Settings
 * writes to.
 *
 * `system` is a real third option, not "dark by another name": NativeWind's
 * `colorScheme.set("system")` hands the decision back to the OS, and
 * `global.css` carries a full light palette behind `:root`, so both grounds are
 * designed rather than inverted.
 *
 * Stored in SecureStore because it is the only key-value store this app has —
 * there is no AsyncStorage in the tree. Nothing here is a secret, and nothing
 * here is treated as one: a failed read or write costs the user their theme
 * choice and nothing else, so every call is swallowed rather than surfaced.
 */

import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

export type ThemePreference = "system" | "light" | "dark";

const KEY = "kashplus.theme";

/** Kept out of the auth service so `storage.clearAll()` can't take it with it. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "kashplus.prefs",
};

/**
 * SecureStore is iOS/Android only — on web its methods do not exist and calling
 * one throws. Same shim, same reason, as `src/lib/auth/storage.ts`.
 */
const isWeb = Platform.OS === "web";

function isPreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** What ships when nobody has chosen — see the note in `_layout.tsx`. */
export const DEFAULT_THEME: ThemePreference = "dark";

let current: ThemePreference = DEFAULT_THEME;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => current;

/** Paint in it, remember it, and tell every reader. */
function apply(next: ThemePreference, persist: boolean) {
  colorScheme.set(next);
  if (current !== next) {
    current = next;
    for (const listener of listeners) listener();
  }
  if (!persist) return;

  void (async () => {
    try {
      if (isWeb) globalThis.localStorage?.setItem(KEY, next);
      else await SecureStore.setItemAsync(KEY, next, OPTIONS);
    } catch {
      // The theme is applied either way; only its survival across launches is
      // lost, and there is nothing a person could do about it from here.
    }
  })();
}

/**
 * Read the stored choice and apply it. Call once, at boot.
 *
 * Resolves either way — a device with nothing stored is the commonest case, not
 * an error — so the caller can simply `void` it.
 */
export async function hydrateTheme(): Promise<void> {
  try {
    const stored = isWeb
      ? (globalThis.localStorage?.getItem(KEY) ?? null)
      : await SecureStore.getItemAsync(KEY, OPTIONS);
    if (isPreference(stored)) apply(stored, false);
  } catch {
    // Keep the launch default. A theme is not worth a boot failure.
  }
}

/** The Appearance control's whole contract. */
export function setThemePreference(next: ThemePreference): void {
  apply(next, true);
}

/** `[preference, set]`, subscribed — the reader repaints when it changes. */
export function useThemePreference(): [
  ThemePreference,
  (next: ThemePreference) => void,
] {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [value, setThemePreference];
}
