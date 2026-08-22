# Decane auth — setup

**SDK:** `decane-connect-kit-expo` 0.1.2 · **Project:** `64503a4c-5b87-4a05-a547-18b2594bf8d6`
**Replaces:** the hosted web auth surface (deleted 2026-08-15 — obsolete once the
native SDK shipped).

## What changed

Decane shipped a headless React Native SDK, so the app talks to Decane directly.
Gone with it: the hosted web page, the `paradigm://auth/callback` contract we
designed, `EXPO_PUBLIC_AUTH_URL`, and the KingsChat bridge issuer the PRD (§F1)
put on the critical path — **KingsChat is a built-in `authMethod` now.**

| Concern | Owner |
|---|---|
| Wallet session, key shares, signing | Decane SDK (persists to keystore) |
| Access token for `primal-be` | `decane.getAccessToken()` |
| Transaction PIN (money-out), app-lock | `src/lib/auth/storage.ts` |
| Route gating / onboarding step | `src/lib/auth/AuthContext.tsx` |

## ⚠ Requires a development build

`expo-secure-store` and `react-native-passkeys` are native modules. **Expo Go
cannot run this app** — it rejects the project before any JavaScript executes,
which presents as the app opening and closing instantly with nothing in the
Metro logs. Decane's docs call this the single most common integration failure.

```bash
npx expo prebuild
npx expo run:ios      # or run:android
```

## Configuration

Three env values (see `.env.example`). All are `EXPO_PUBLIC_*` and ship in the
bundle:

| Var | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_DECANE_APP_ID` | yes | Public project id |
| `EXPO_PUBLIC_DECANE_API_KEY` | yes | `dck_live_…`; extractable from the binary by design |
| `EXPO_PUBLIC_DECANE_RP_ID` | passkey tier | No default — unset silently drops to secure-enclave |

### Dashboard

The API key's **callback URL must be exactly `paradigm://auth`** — matching
`scheme` in `app.json` and `REDIRECT_URI` in `src/lib/auth/decane.ts`. The
backend redirects only to the registered value and ignores anything passed at
call time, so a mismatch fails every Google and KingsChat sign-in.

One project can hold several keys; a web app and this app need different
callback URLs, which is why two keys on one `appId` is the normal arrangement.
Same `appId` means the same person gets the **same wallet** on web and mobile.

## Running with no credentials — the placeholder identity

`__DEV__` only. Without `EXPO_PUBLIC_DECANE_APP_ID` and
`EXPO_PUBLIC_DECANE_API_KEY` the SDK cannot initialise at all, so a dev build
falls back to stand-ins for **both** halves of the identity stack:

| Real | Stand-in |
|---|---|
| Decane wallet | `src/lib/auth/placeholder.ts` — a persisted `0xdead…` wallet, minted fresh per sign-in |
| `api.tsion.io` | `src/lib/gateway/placeholder.ts` — answers `client.ts`'s one `fetch` on-device |
| Face ID / fingerprint | `src/lib/auth/biometrics.ts` — a simulated prompt, when the device has none |

The biometric stand-in engages only when a real check is impossible here: no
enrolled biometric, or iOS Expo Go (whose binary carries no
`NSFaceIDUsageDescription`, so reaching for Face ID terminates the process —
`getCapability()` now reports that device as having none, which closes the crash
for every caller). Anything it touches carries `placeholder: true`, and the
setup screen says so on its face.

**Nothing is skipped.** The app performs its real sequence — SIWE handshake,
entitlement probe, subscription create, payment poll, entitlement re-probe —
and every gate still has to be satisfied; only the server on the other end has
changed. The full walk is:

```
sign in → set PIN → enable biometric unlock → pay → welcome aboard → home
```

The placeholder payment moves `AWAITING_TRANSFER → PROCESSING → SETTLED` over
12s (`EXPO_PUBLIC_DEV_PLACEHOLDER_SETTLE_MS`), and settling is what grants
entitlement — decided in the stand-in for the server, never by the app, exactly
as the real rule requires.

The app lock is real either way: the PIN is a salted SHA-256 in the keychain,
and the biometric preference is now honoured at unlock — a user who answers
"Maybe later" gets the keypad, where before they got a Face ID sheet on every
launch regardless of what they chose.

Signing out drops the placeholder wallet, so the next sign-in is a new account
and walks the whole sequence again. Membership is keyed to the wallet, so a
relaunch restores a paid account the way a real one is restored.

Two things it deliberately will not do: the deposit address is the zero address
(a fake checkout must not display anywhere a person could send money), and any
route outside sign-in, entitlement and the membership checkout answers 501 and
says so once in the log.

It switches itself off the moment the Decane credentials above are set. Set
`EXPO_PUBLIC_DEV_PLACEHOLDER_AUTH=0` to refuse the fallback and see the real
failure instead. See `src/lib/devMode.ts`.

## Unlock tiers

The device share is encrypted at rest, and the SDK probes tiers in order
(`passkey` → `secure-enclave` → `pin`), using the first that genuinely works.
The passkey probe is a real ceremony, not a feature flag: a device that claims
passkey support but returns no PRF output falls through rather than ending up
with a wallet nothing can open.

We request the passkey tier. It needs, before it will engage:

1. `EXPO_PUBLIC_DECANE_RP_ID` set to a domain we control.
2. **iOS** — `webcredentials:<rpId>` in the associated-domains entitlement, and
   an `apple-app-site-association` file served from that domain.
3. **Android** — `assetlinks.json` on that domain, plus an explicit `origin` of
   `android:apk-key-hash:<base64url sha256 of the signing cert>`, because
   Android reports an APK key hash rather than a URL origin.
4. OS support for the WebAuthn PRF extension — roughly iOS 18+ / Android 14+.

**Expect two biometric prompts at signup** on this tier: WebAuthn's `create()`
only reports that PRF is *available*, so a follow-up assertion is needed to
evaluate it. It does not repeat on later unlocks.

Until those are in place the SDK uses the secure-enclave tier, which works fine
but has no passkey sign-in and no `rotateShares`.

## Recovery

Sign-in alone restores a wallet on a new device — always on, not configurable.
The enclave holds two shares and can issue a fresh device share to anyone who
authenticates. **The trade, stated plainly:** an enrolled wallet can be
reconstructed by the enclave alone. Our backend cannot, but a malicious enclave
image or anyone able to mint JWTs could.

Recovery-file callbacks (`onRecoveryShareOffer`, `onRecoveryFileReady`,
`promptForRecoveryFile`, `onRecoveryRotated`) are **not yet wired** — they are
the fallback when server-assisted recovery is unavailable. Worth adding before
launch.

## Known gaps

1. **`verifyAttestation` is not supplied.** React Native has no WebAssembly, so
   the Intel DCAP verifier cannot run on device. Without the hook the SDK checks
   only that the enclave *reports* the pinned measurement — a self-assertion,
   not proof. Decane's docs call the hook "strongly recommended in production";
   it needs `primal-be` to verify the quote server-side.
2. **`promptPin` throws if the PIN tier is ever reached.** We store a salted
   hash, never the PIN, so there is nothing to hand back. `setPinPrompt()` in
   `decane.ts` is the hook for a PIN sheet — unwired, because the tier is only
   reachable on devices with neither passkeys nor a secure enclave.
3. **Recovery-file callbacks unwired** (above).
