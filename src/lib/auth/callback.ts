/**
 * Parsing of the redirect the hosted auth surface sends back.
 *
 * Kept free of every `expo-*` import on purpose: this is the contract between
 * the app and a surface that doesn't exist yet, so it's the part most likely to
 * be wrong, and staying dependency-free means it can be exercised directly
 * rather than only through a running app.
 */

export type CallbackResult =
  | { ok: true; accessToken: string; expiresAt: number | null; isNewUser: boolean }
  | { ok: false; reason: "state_mismatch" | "no_token" | "provider_error"; message: string };

/**
 * Params may arrive as a query string or a fragment — a surface that keeps the
 * token out of its own server logs will use the fragment, so accept both. When
 * a key appears in each, the fragment wins: it is the one the browser never
 * transmitted upstream.
 */
export function readParams(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const hashAt = url.indexOf("#");
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const afterHash = hashAt === -1 ? "" : url.slice(hashAt + 1);

  const queryAt = beforeHash.indexOf("?");
  const query = queryAt === -1 ? "" : beforeHash.slice(queryAt + 1);

  for (const source of [query, afterHash]) {
    if (!source) continue;
    for (const [key, value] of new URLSearchParams(source)) merged.set(key, value);
  }
  return merged;
}

/** `now` is injectable so expiry maths can be asserted without faking a clock. */
export function parseCallback(
  url: string,
  expectedState: string,
  now: number = Date.now(),
): CallbackResult {
  const params = readParams(url);

  // An error response carries no state to compare, so it is read first.
  const error = params.get("error");
  if (error) {
    return {
      ok: false,
      reason: "provider_error",
      message: params.get("error_description") ?? "Decane rejected the sign-in.",
    };
  }

  if (params.get("state") !== expectedState) {
    return {
      ok: false,
      reason: "state_mismatch",
      message: "Sign-in response failed verification.",
    };
  }

  const accessToken = params.get("access_token");
  if (!accessToken) {
    return {
      ok: false,
      reason: "no_token",
      message: "No access token in the sign-in response.",
    };
  }

  const expiresIn = Number(params.get("expires_in"));
  return {
    ok: true,
    accessToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? now + expiresIn * 1000 : null,
    isNewUser: params.get("is_new_user") === "true",
  };
}
