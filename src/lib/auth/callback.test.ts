import { describe, expect, test } from "bun:test";

import { parseCallback, readParams } from "./callback";

// Fixed clock so expiry maths is asserted rather than approximated.
const NOW = 1_700_000_000_000;
const STATE = "state123";

describe("query-string callback", () => {
  const result = parseCallback(
    `primal://auth/callback?access_token=tok_abc&expires_in=1800&state=${STATE}&is_new_user=true`,
    STATE,
    NOW,
  );

  test("succeeds", () => expect(result.ok).toBe(true));

  test("reads token, expiry and new-user flag", () => {
    if (!result.ok) throw new Error("expected success");
    expect(result.accessToken).toBe("tok_abc");
    expect(result.expiresAt).toBe(NOW + 1_800_000);
    expect(result.isNewUser).toBe(true);
  });
});

describe("fragment callback", () => {
  // A surface that keeps the token out of its own server logs returns it in
  // the fragment, which the browser never transmits upstream.
  test("reads a token delivered in the fragment", () => {
    const result = parseCallback(
      `primal://auth/callback#access_token=tok_frag&expires_in=60&state=${STATE}`,
      STATE,
      NOW,
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.accessToken).toBe("tok_frag");
    expect(result.isNewUser).toBe(false);
  });

  test("merges query and fragment halves", () => {
    const result = parseCallback(
      `primal://auth/callback?state=${STATE}#access_token=tok_mixed&expires_in=900`,
      STATE,
      NOW,
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.accessToken).toBe("tok_mixed");
  });
});

describe("state verification", () => {
  // Any other app on the device can open primal://, so a token that arrives
  // without our state is a token we never asked for.
  test.each([
    ["mismatched", `primal://auth/callback?access_token=tok&state=WRONG`],
    ["missing", `primal://auth/callback?access_token=tok`],
    ["empty", `primal://auth/callback?access_token=attacker_token&state=`],
  ])("rejects %s state", (_label, url) => {
    const result = parseCallback(url, STATE, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("state_mismatch");
  });
});

describe("error responses", () => {
  test("surfaces the provider description", () => {
    const result = parseCallback(
      `primal://auth/callback?error=access_denied&error_description=User%20declined`,
      STATE,
      NOW,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("provider_error");
    expect(result.message).toBe("User declined");
  });

  test("falls back to a generic message", () => {
    const result = parseCallback(`primal://auth/callback?error=server_error`, STATE, NOW);
    if (result.ok) throw new Error("expected failure");
    expect(result.message.length).toBeGreaterThan(0);
  });

  test("reports the error rather than masking it as a state mismatch", () => {
    // An error response carries no state, so checking state first would show
    // the user a misleading "couldn't be verified" toast.
    const result = parseCallback(`primal://auth/callback?error=boom&state=WRONG`, STATE, NOW);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("provider_error");
  });
});

describe("token and expiry edge cases", () => {
  test("no token is reported distinctly", () => {
    const result = parseCallback(`primal://auth/callback?state=${STATE}`, STATE, NOW);
    if (result.ok) throw new Error("expected failure");
    expect(result.reason).toBe("no_token");
  });

  test.each([
    ["absent", ""],
    ["non-numeric", "&expires_in=abc"],
    // A negative TTL must not produce a past-dated expiry, which would make a
    // fresh session look expired the moment it is restored.
    ["negative", "&expires_in=-5"],
  ])("%s expires_in yields a null expiry", (_label, fragment) => {
    const result = parseCallback(
      `primal://auth/callback?access_token=tok${fragment}&state=${STATE}`,
      STATE,
      NOW,
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.expiresAt).toBeNull();
  });

  test("a JWT survives URL encoding intact", () => {
    const jwt = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1XzEifQ.sig-with_chars";
    const result = parseCallback(
      `primal://auth/callback?access_token=${encodeURIComponent(jwt)}&state=${STATE}`,
      STATE,
      NOW,
    );
    if (!result.ok) throw new Error("expected success");
    expect(result.accessToken).toBe(jwt);
  });
});

test("a bare url yields no params", () => {
  expect([...readParams("primal://auth/callback").keys()]).toHaveLength(0);
});
