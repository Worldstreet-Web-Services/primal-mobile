/**
 * Hosts that are configured but gone, neutralised in code.
 *
 * `worldstreetwebservices.com` used to serve the wsws web app's own Next.js
 * `/api/*` routes. That deployment is down, and it does not 404 — it
 * BLACKHOLES: the connection never completes, so every request costs a full
 * timeout instead of failing. React Native's fetch also ignores AbortSignal
 * on a connection that never opens, so the usual 15s guard doesn't rescue it
 * either. The result was a UI that hung, then blamed the network.
 *
 * The live gateway at `api.worldstreetwebservices.com` is a DIFFERENT service
 * (earn, chess, vault) and answers normally — it must keep working, so the
 * check compares the exact hostname rather than matching a substring.
 *
 * This lives in code rather than in .env alone because the same dead value is
 * configured in EAS, and a build should not depend on remembering to fix it
 * in two places.
 */
const DEAD_HOSTS = new Set(["worldstreetwebservices.com", "www.worldstreetwebservices.com"]);

/** Hostname of a URL, or null when it isn't a parseable absolute URL. */
function hostOf(url: string): string | null {
  const match = /^https?:\/\/([^/?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase().replace(/:\d+$/, "") : null;
}

/** True when this URL points at a host known to be gone. */
export function isDeadHost(url: string): boolean {
  const host = hostOf(url);
  return host !== null && DEAD_HOSTS.has(host);
}

/**
 * A configured base URL, or "" when it points somewhere dead. Callers already
 * treat an empty base as "this integration isn't set up", which is exactly the
 * right behaviour here — fail immediately and say so, rather than hang.
 */
export function liveBaseUrl(url: string | undefined): string {
  const value = url ?? "";
  return value && !isDeadHost(value) ? value : "";
}
