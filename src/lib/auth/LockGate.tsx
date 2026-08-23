import { useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "./AuthContext";

/**
 * Routes that stay reachable while the app is locked: the auth surface itself
 * (you cannot unlock from behind the lock), plus the entry route, which does
 * its own redirecting in `index.tsx`.
 */
const OPEN_WHILE_LOCKED = new Set([
  "unlock",
  "welcome",
  "signin",
  "pin",
  "passkey",
  "email",
  "continue",
]);

/**
 * The app-wide lock.
 *
 * `index.tsx` redirects a locked user to /unlock, but that only covers the one
 * route the user actually launches into. A deep link — `kashplus://fiat`, a
 * notification tap, a link out of KingsChat — mounts its route directly and
 * never passes through the entry screen, so before this existed a locked device
 * would render the fiat space, balance, account number and the payout flow with
 * the PIN never entered. Verified on a cold-launched simulator, 2026-08-16.
 *
 * Renders nothing; it exists for the effect. It has to live inside the
 * navigator (so `useSegments` resolves) and inside `AuthProvider` (so it can
 * see the lock), which is why it mounts as a sibling of the `Stack`.
 */
export function LockGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Only the head segment matters: a group like `(payments)` is not in the
  // allowlist, so everything nested under it is gated with it. Widened to
  // `string` deliberately — expo-router types this as a union of known route
  // names, and the entry route is the empty segment list, not a member of it.
  const head: string = segments.length > 0 ? segments[0] : "";

  useEffect(() => {
    if (status !== "locked") return;
    if (head === "" || OPEN_WHILE_LOCKED.has(head)) return;
    // `replace`, not `push` — the locked route must not survive in the back
    // stack for a swipe-back to reveal it after unlocking.
    router.replace("/unlock");
  }, [status, head, router]);

  return null;
}
