/**
 * Who the signed-in person is, as far as anything has actually told us.
 *
 * Since decane-connect-kit-expo 0.2.0 every connect method's `ConnectResult`
 * can carry `profile` — `{name?, email?, picture?}`, straight from the
 * identity provider. It exists ONLY at the sign-in moment: Decane keeps an
 * HMAC and a masked identifier by design, so there is no endpoint to ask
 * later, and a restored session arrives with `profile === undefined`. If a
 * name is to survive a reload, THE APP persists it — that is this module —
 * and clears it on sign-out (AuthContext), or the next person to sign in on
 * this device is greeted as the last one.
 *
 * Two sources, ranked:
 *
 *  - `decane-profile` — what the provider released at the sign-in moment,
 *                       written down then because then is the only chance.
 *                       Present for Google and KingsChat sign-ins; absent —
 *                       `undefined`, never `{}` — for the email flow and for
 *                       a user who withheld consent.
 *  - `email-entry`    — the user typed this email into OUR screen and then
 *                       proved they own it with the code. First-hand.
 *
 * `decane-profile` outranks `email-entry` on display — a Google name beats an
 * email local-part — but the ranking is between FACTS, not flows: a sign-in
 * that carried no profile brings no fact to the table, so it must never blank
 * an email-entry record down to a method-only one. See recordDecaneProfile.
 *
 * The record is persisted, cleared on sign-out by AuthContext, and never
 * logged: it is personal data, and "never logged" includes the failure paths.
 */

import type { AuthProfile } from "decane-connect-kit-expo";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { AuthMethod } from "@/lib/auth/decane";

export type IdentitySource = "email-entry" | "decane-profile";

export interface IdentityRecord {
  /** A human name, e.g. "Ada Obi". Null unless a source actually said one. */
  displayName: string | null;
  /**
   * A username WITHOUT the "@" sigil — display adds it. No current writer
   * produces one (the Decane profile has no username field); it survives here
   * because records migrated from older builds can carry one, and display
   * still prefers it over the email local-part.
   */
  handle: string | null;
  /**
   * DISPLAY ONLY. Never key an account, a lookup or a link on this address —
   * emails change, and the stable identity is the sign-in userId / the
   * wallet. This field exists so a greeting and a profile card can say what
   * the provider said, nothing more.
   */
  email: string | null;
  /**
   * Avatar URL as the provider released it. A plain https URL, not a secret —
   * what is sensitive about this record is the association with a person, not
   * the picture itself. Null when no source produced one.
   */
  picture: string | null;
  /** How this session was signed in. The one field that is always known. */
  method: AuthMethod;
  /**
   * Where the name facts came from. Null when nothing beyond the method is
   * known — a method-only record, the honest whole of what a profile-less
   * sign-in leaves behind.
   */
  source: IdentitySource | null;
}

/* ------------------------------------------------------------- persistence */

/**
 * Same service and accessibility as storage.ts, deliberately. The vendor
 * suggests AsyncStorage for the cached profile — fair, since none of it is
 * secret — but the record lives and dies with the rest of the auth keychain:
 * one store, one accessibility rule (device-unlocked reads only, never riding
 * a backup to another device), and one clearing path on sign-out. A second
 * store would be a second place sign-out could forget to sweep, to save
 * keychain room one small JSON blob does not need.
 */
const KEY = "paradigm.auth.identity";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.auth",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Web is a layout-preview target; see the twin shim in storage.ts. */
const isWeb = Platform.OS === "web";

async function put(value: string): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.setItem(KEY, value);
    } catch {
      /* private mode / storage disabled — dev-only path, ignore */
    }
    return;
  }
  await SecureStore.setItemAsync(KEY, value, OPTIONS);
}

async function get(): Promise<string | null> {
  if (isWeb) {
    try {
      return globalThis.localStorage?.getItem(KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(KEY, OPTIONS);
}

async function drop(): Promise<void> {
  if (isWeb) {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      /* as above */
    }
    return;
  }
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}

const METHODS: readonly AuthMethod[] = ["google", "email", "kingschat"];
const SOURCES: readonly IdentitySource[] = ["email-entry", "decane-profile"];

/**
 * Sources written by builds on SDK 0.1.x, before `ConnectResult` carried the
 * profile: `jwt-claims` (display-safe strings decoded out of the Decane JWT
 * on-device) and `kingschat-profile` (KingsChat's API, asked via the split
 * sign-in flow). Both were the issuer asserting the same kind of fact the
 * profile now delivers directly, so a persisted record from either loads as
 * `decane-profile` rather than crashing or being thrown away — the next
 * sign-in rewrites it in the current shape regardless.
 */
const LEGACY_SOURCES = ["jwt-claims", "kingschat-profile"];

/**
 * Restore the persisted record, or null. A record that does not parse — a
 * schema from an older build, a corrupt entry — is dropped and reported as
 * absent rather than surfaced: signing in again rewrites it, and a greeting
 * with no name is a working state, not an error.
 */
export async function loadIdentity(): Promise<IdentityRecord | null> {
  const raw = await get();
  if (raw === null) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const method = parsed.method;
    if (!METHODS.includes(method as AuthMethod)) throw new Error("bad method");

    const source = parsed.source;
    return {
      displayName: displayString(parsed.displayName),
      handle: displayString(parsed.handle),
      email: displayString(parsed.email),
      // Absent on every pre-0.2.0 record, which reads as null — honest, since
      // no picture was ever captured for those sessions.
      picture: pictureString(parsed.picture),
      method: method as AuthMethod,
      source: SOURCES.includes(source as IdentitySource)
        ? (source as IdentitySource)
        : LEGACY_SOURCES.includes(source as string)
          ? "decane-profile"
          : null,
    };
  } catch {
    await drop().catch(() => {});
    return null;
  }
}

export async function clearIdentity(): Promise<void> {
  await drop();
}

async function save(record: IdentityRecord): Promise<IdentityRecord> {
  await put(JSON.stringify(record));
  return record;
}

/* ----------------------------------------------------------------- writers */

/**
 * The email flow: the user typed this address into our own screen and proved
 * it with the code, which makes it the one identity fact the app holds
 * first-hand. Recorded at verify time — an unverified address is a claim.
 */
export async function recordEmailIdentity(email: string): Promise<IdentityRecord> {
  return save({
    displayName: null,
    handle: null,
    email: displayString(email),
    picture: null,
    method: "email",
    source: "email-entry",
  });
}

/**
 * The profile moment. Decane hands the provider's profile over exactly once —
 * on the connect that just happened — and never again, so whatever the app
 * wants a reload to remember is written down here, now.
 *
 * `undefined` is a real state, not a miss: the email flow never has one, and
 * a Google or KingsChat user can withhold consent. A profile-less sign-in
 * records the method alone — EXCEPT over a standing email-entry record. That
 * record is first-hand and a blank does not outrank it, so its facts stay and
 * only the method is restamped to the one actually used this time (the "VIA …"
 * line must describe this session, not the one that typed the address). What
 * an email-entry record must never be is silently wiped because a later
 * sign-in happened to release nothing.
 */
export async function recordDecaneProfile(
  profile: AuthProfile | undefined,
  method: AuthMethod,
): Promise<IdentityRecord> {
  const displayName = displayString(profile?.name);
  const email = displayString(profile?.email);
  const picture = pictureString(profile?.picture);

  if (displayName === null && email === null && picture === null) {
    const existing = await loadIdentity();
    if (existing?.source === "email-entry" && existing.email !== null) {
      return save({ ...existing, method });
    }
    return save({
      displayName: null,
      handle: null,
      email: null,
      picture: null,
      method,
      source: null,
    });
  }

  return save({
    displayName,
    // The Decane profile carries no username; handles only exist on records
    // migrated from older builds.
    handle: null,
    email,
    picture,
    method,
    source: "decane-profile",
  });
}

/* ------------------------------------------------------------------ guards */

/**
 * The only shape allowed through to a screen: a real, bounded, non-empty
 * string. Everything else — numbers, objects, empty strings, a "name" long
 * enough to be a payload — is treated as absent. Absence is safe; the record
 * renders as the salutation alone.
 */
function displayString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 190) return null;
  return trimmed;
}

/**
 * The picture is a URL the provider handed over, not a secret — but it is
 * still a string the app will point an <Image> at, so only a plausible https
 * URL is kept. Anything else (http, data:, javascript:, an essay) is treated
 * as absent, and absent renders as the initial-letter circle.
 */
function pictureString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}
