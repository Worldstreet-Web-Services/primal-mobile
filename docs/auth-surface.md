# Primal hosted auth surface — implementation spec

**Status:** proposed · **Consumer:** `paradigm-mobile` (`src/lib/auth/decane.ts`)
**Decane:** `decane-connect-kit` 2.5.0 · project `64503a4c-5b87-4a05-a547-18b2594bf8d6`

## Why this exists

`decane-connect-kit` is a **web** package — React 18 peer dependency, sessions in
`localStorage`, device key-share in IndexedDB, WebAuthn passkeys, wallet detection off
`window`. There is no React Native or Expo build, so the Expo app cannot import it at
any version. Verified against `kit.decane.app/llms.txt` (2.5.0) on 2026-08-14.

The supported path (PRD §F1) is a small web page of ours that runs Decane Kit. The app
opens it with `WebBrowser.openAuthSessionAsync` — `ASWebAuthenticationSession` on iOS,
Custom Tabs on Android — and the page hands the Decane access token back over a deep
link. Wallet **signing** must eventually run in this same surface, because the device
key-share lives in its storage.

Scope for phase 1: **Google and email only.** KingsChat needs the bridge issuer and is
out of scope here.

## Flow

```
Primal app                    auth surface (this)              Decane / Google
    │                                │                                │
    │  openAuthSessionAsync ────────►│                                │
    │   ?method&redirect_uri         │  <DecaneKit mode="social">     │
    │   &state&app_id                │                                │
    │                                │  signInWithGoogle() ──────────►│
    │                                │◄──── OAuth callback ───────────│
    │                                │      (dashboard Callback URL)  │
    │◄─ 302 paradigm://auth/callback ──│                                │
    │   #access_token&state          │                                │
```

Two distinct redirects, easily confused:

- **Dashboard → API key → Callback URL** is the *web* hop: where Decane returns after
  OAuth. Must be `https://` on this surface's own domain.
- **`paradigm://auth/callback`** is app-side only. It is issued by this surface at the
  end. Decane never sees it and it must never be entered in the dashboard.

## ⚠ Pick the domain before shipping — it is effectively permanent

Decane derives the WebAuthn **RP ID** from `window.location.hostname` unless `rpId` is
set explicitly. Passkeys are bound to that RP ID by the browser and the platform
authenticator: **move the surface to a different hostname and every existing passkey
stops resolving.** Users fall back to recovery, on a screen that is supposed to be the
easy path.

Consequences:

- Decide the production hostname now (e.g. `auth.primal.app`) and set `rpId` explicitly
  rather than letting it default, so the value survives a hosting change.
- Never let real users sign in against a preview/ephemeral deployment URL — those
  passkeys bind to a hostname that disappears.
- Hosting the surface as a path on the API origin (`api.primal.app/auth`) is workable,
  but it welds the passkey identity to the API's hostname. A dedicated subdomain keeps
  the two able to move independently.

This sits alongside the custom-auth `issuer` / `identity_claim` immutability as one of
the few genuinely irreversible choices in the integration.

## Request — what the app sends

Opened as a top-level navigation to the surface root:

| Param | Required | Notes |
|---|---|---|
| `method` | yes | `google` \| `email` — which button to auto-trigger |
| `redirect_uri` | yes | Always the `paradigm://` deep link |
| `state` | yes | Opaque, single-use, generated per attempt |
| `app_id` | when set | Decane project id, so one surface serves test + live |

## Response — what the surface must return

Redirect to the `redirect_uri`. **Put params in the URL fragment (`#`), not the query
(`?`)** — the app parses both, but a fragment is never transmitted to a server, so the
token stays out of every intermediate access log.

Success:

| Param | Required | Notes |
|---|---|---|
| `access_token` | yes | The Decane access token, URL-encoded |
| `state` | yes | Echoed back **verbatim** |
| `expires_in` | recommended | Seconds. Omit rather than guess — the app treats a missing, non-numeric, or negative value as "unknown expiry" |
| `is_new_user` | optional | `true` / `false`, from `ConnectResult.isNewUser` |

Failure:

| Param | Required | Notes |
|---|---|---|
| `error` | yes | Short machine code, e.g. `access_denied` |
| `error_description` | recommended | One human sentence; shown in a toast verbatim |

The app checks `error` **before** `state`, so an error response need not carry state.

Contract is enforced by `src/lib/auth/callback.test.ts` (16 tests) — run `bun test`
against any change here.

## Security requirements

1. **Validate `redirect_uri` against an allowlist** before redirecting to it. Accept only
   the `paradigm://` scheme. An open redirector here would forward a live token to any app
   that asked.
2. **Echo `state` exactly.** The app rejects mismatched, missing, and empty state; that
   check is the only thing stopping another app on the device from feeding us a token.
3. **Never log the token** — not in access logs, not in analytics, not in Sentry
   breadcrumbs. This is what the fragment requirement is for.
4. **Restrict the API key's allowed origins** to this surface's domain. `dck_live_…` is
   server-side config, never client-visible.
5. Serve over `https://` only.

## Decane Kit configuration

```tsx
<DecaneKit config={{
  appId: '<from ?app_id, or the project default>',
  mode: 'social',                       // no wallet-connect surface in phase 1
  social: {
    apiKey: process.env.DECANE_API_KEY, // server-side only
    authMethods: ['google', 'email'],
    promptPin: () => showPinModal(),    // required where WebAuthn is unavailable
  },
}}>
```

Email is Decane's own two-step flow (`sendEmailCode` → `confirmEmailCode`) and resolves
entirely inside this page — the app deliberately has no email or OTP screens.

Do **not** set `preferEphemeralSession` on the app side (it is already `false`): the
device key-share lives in this surface's storage, and a private session would discard it
on every sign-in, forcing recovery each launch.

## Sign-out

`GET /logout?redirect_uri=…` — ends the Decane session, then redirects back. The app
calls this on sign-out; without it the surface keeps its own session and the next
sign-in silently reuses it, so the sign-out looks like it never happened.

## ⚠ Open question — blocks implementation

**How does this page obtain the access token to forward?**

`llms.txt` Part 3 says to send "the Decane access token (`getAccessToken()` on the
client)" — but `getAccessToken()` appears in **no** published interface: not in
`DecaneConnect` (which the spec labels the full method set), not in `useSocialAuth()`,
not in `useSocialWallet()`.

Until Decane confirms, options in order of preference:

1. `getAccessToken()` exists and is merely undocumented → use it.
2. The token is readable from the session the SDK persists in `localStorage`.
3. Decane exposes a server-side exchange this page's backend can call.

Everything else in this spec holds regardless; only the one line that produces
`access_token` changes.
