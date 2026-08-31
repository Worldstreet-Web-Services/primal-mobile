import { useInactive } from "@/hooks/useInactive";

/**
 * Mounts the away-timeout that closes the app lock.
 *
 * Renders nothing; it exists for the effect, and it has to live inside
 * `AuthProvider` to see the session — which is why it is a component rather
 * than a call somewhere in the layout.
 *
 * It wrapped the entire tree in a `View` until the rule changed: while idle
 * time in the foreground counted toward the timeout, something had to sit above
 * everything and watch touches pass. Time on screen is no longer counted, so
 * there is nothing to observe and no wrapper to justify — this is now a sibling
 * of `LockGate`, and the pair reads as what it is: this one decides WHEN the
 * app locks, that one decides where a locked app is allowed to be.
 */
export function InactivityLock() {
  useInactive();
  return null;
}
