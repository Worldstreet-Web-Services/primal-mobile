/**
 * Lock the app after it has been away long enough.
 *
 * "Away" means the app is not on screen: backgrounded, switched out of, or
 * still frontmost on a phone whose screen has been locked — iOS and Android
 * both report that last one as `background`, so one rule covers all three.
 *
 * **Time with the app open is not counted, however idle it looks.** A person
 * reading a statement, filling in a transfer, or watching a payment settle is
 * present, and locking the screen out from under them is a worse failure than
 * anything the timeout prevents: the phone is in their hand, and the lock is
 * there for when it is not. So there is no idle timer, no touch tracking, and
 * nothing to reset — the only clock that runs is the one that starts when the
 * app leaves the screen.
 *
 * **Away is `background`, never `inactive`.** iOS reports `inactive` for the
 * notification shade, Control Centre, the app switcher, an incoming call and
 * every system sheet — including the Face ID prompt this app raises to sign.
 * Counting those as leaving would mean raising a biometric prompt could lock
 * the app underneath it. `src/lib/appActive.ts` settled this distinction for
 * the REST pollers already; this is the same rule for the same reason.
 *
 * **The decision is made on return, from the wall clock**, not by a timer that
 * fires while away. iOS suspends JS timers in the background and Android does
 * not, so a timer would mean two different behaviours; comparing timestamps
 * means one. It also means the lock lands during the frames `PrivacyOverlay`
 * is still covering the screen, so nothing is on show before it does.
 *
 * Where the lock is ENFORCED is `LockGate`, which is already the one place that
 * sends a locked app to `/unlock` no matter which route it is sitting on. This
 * hook only decides when.
 */

import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Production: two minutes away, and not configurable.
 *
 * An app-lock timeout is a security control, so the shipped value is a constant
 * in the binary rather than something an environment variable can widen. There
 * is no `EXPO_PUBLIC_*` that can lengthen this in a release build.
 */
const PRODUCTION_LOCK_AFTER_MS = 2 * 60_000;

/** Development: one minute, so the behaviour is testable inside a dev session. */
const DEV_LOCK_AFTER_MS = 60_000;

/**
 * A dev build may lengthen the window (`EXPO_PUBLIC_DEV_LOCK_AFTER_MS`) but
 * never shorten it below a minute. A mistyped `0` or `500` would lock on every
 * glance at another app and read as a crash loop, which is a worse way to lose
 * an hour than any lock timeout is worth.
 */
const DEV_MINIMUM_LOCK_AFTER_MS = 60_000;

function resolveLockAfterMs(): number {
  if (!__DEV__) return PRODUCTION_LOCK_AFTER_MS;

  const configured = Number(process.env.EXPO_PUBLIC_DEV_LOCK_AFTER_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEV_LOCK_AFTER_MS;
  return Math.max(DEV_MINIMUM_LOCK_AFTER_MS, configured);
}

/** How long the app may be off screen before it locks. */
export const LOCK_AFTER_MS = resolveLockAfterMs();

export function useInactive(): void {
  const { status, lock } = useAuth();

  /**
   * Armed only while `ready`. Locking during onboarding would strand a user at
   * a keypad before they have chosen a PIN — `lock()` refuses that too, but
   * arming for it would still subscribe for something that can never fire
   * usefully.
   */
  const armed = status === "ready";

  useEffect(() => {
    if (!armed) return;

    /** When the app left the screen. `null` while it is on screen. */
    let awaySince: number | null = null;

    const onAppState = (next: AppStateStatus) => {
      if (next === "background") {
        // Only the FIRST background starts the clock. Some launchers and some
        // OS transitions report background twice, and restarting on the second
        // would quietly forgive the time already spent away.
        awaySince ??= Date.now();
        return;
      }
      // Deliberately nothing for `inactive`: the content is still on screen and
      // the user has not left. See the note at the top of this file.
      if (next !== "active") return;
      if (awaySince === null) return;

      const away = Date.now() - awaySince;
      awaySince = null;
      if (away >= LOCK_AFTER_MS) lock();
    };

    const subscription = AppState.addEventListener("change", onAppState);
    return () => subscription.remove();
  }, [armed, lock]);
}
