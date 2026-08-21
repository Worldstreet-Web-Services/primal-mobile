import { useSyncExternalStore } from "react";

/**
 * Whether the portfolio figure is masked, for this run of the app.
 *
 * Module scope on purpose. It has to outlive the home route — pushing to /fiat
 * and coming back must not un-hide a figure the member just hid, and component
 * state would do exactly that — and it must NOT outlive the process, because
 * this is a shoulder-surfing convenience and nothing more. Persisting it to
 * disk would make it look like a security setting, which it is not: the digits
 * are in memory either way, the network still carries them, and a screenshot
 * taken while the eye is open is still a screenshot.
 *
 * Kept out of `src/store` because nothing outside the home screen has any
 * business reading it.
 */
let masked = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => masked;

function set(next: boolean) {
  if (next === masked) return;
  masked = next;
  for (const listener of listeners) listener();
}

/** `[masked, toggle]` — the eye's whole contract. */
export function useBalanceMasked(): [boolean, () => void] {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [value, () => set(!masked)];
}
