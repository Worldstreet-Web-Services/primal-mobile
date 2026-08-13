# Primal — Product Requirements Document

**Version:** 0.1 (draft for design)
**Date:** 2026-08-13
**Status:** Draft — feeds Claude Design for UI exploration
**Repo:** `Primal` (Expo SDK 57 · React Native 0.86 · expo-router · NativeWind)

---

## 1. Vision

Primal is a **super app** that folds the best features of our existing platforms into a single account and a single balance surface:

| Source platform | What Primal inherits |
|---|---|
| **Worldstreet** | Copy trading (new — needs API endpoints from Worldstreet, our **major dependency**) |
| **Ark** | Auto-earn ("Kash"), cross-chain crypto deposit & withdrawal, "The Last Man Standing" game with a $50 staking power |
| **LinkPay** | Fiat deposit & withdrawal via per-user account numbers, cross-border payments, the optimistic-fill ledger |

One user, one identity (Decane), two money surfaces — a **fiat account** (bank account number, local currency) and a **crypto account** (embedded wallets + cross-chain deposit addresses) — with money moving fluidly between them because **we run the ledger** and can credit optimistically.

---

## 2. Account model

Every Primal user gets, at onboarding:

1. **A Decane identity** — the root of auth (Decane Kit). Login via **KingsChat** (through Decane custom-auth, §F1), Google, or email; the Decane social wallet gives every user non-custodial **Ethereum and Solana addresses** — the private key is generated client-side and Shamir-split into three shares (device / Decane key server / recovery), so neither side can reconstruct it alone, and signing happens in a TEE unlocked by passkey or PIN.
2. **A fiat virtual account (VA)** — a real bank account number in the user's name, provisioned server-side through our fiat provider (Liquifia; underlying bank currently Rubies). Anyone can bank-transfer to it; funds land as Primal balance. This is the "account number for each user as we have in LinkPay."
3. **Permanent crypto deposit addresses** — static per network-type: one EVM address (serves all supported EVM chains: Ethereum, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche + more), plus Solana, Tron, and Bitcoin addresses. Deposits to these are converted and credited to the fiat balance via **optimistic fill** (§5).

### Identity & security layers (inherited from LinkPay/Ark, both battle-tested)

- **Transaction PIN** (4-digit) for money-out.
- **Passkeys / biometric unlock** (Face ID / fingerprint) for app access and step-up.
- **Device trust**: signup device implicitly trusted; new devices need email step-up before money-out.
- **Self-serve money freeze** (panic switch) and **self-imposed spend limits** (daily/weekly/monthly).
- Account status moderation (active/suspended/banned) gating all money routes.

---

## 3. Feature specifications

### F1 — Authentication (Decane Kit + KingsChat) · **PHASE 1, BUILD NOW**

Auth root switched from Privy to **Decane Kit** (decision 2026-08-13) — the driver is **KingsChat sign-in**.

**How KingsChat comes in.** Decane's built-in `authMethods` are only `"google" | "email"` — KingsChat is not built-in. It arrives through Decane **custom auth**: register a JWT issuer (its `iss`, an `https://` JWKS URL, RS256 or ES256, identity claim defaulting to `sub`) in the Decane dashboard, and the SDK exchanges that issuer's tokens for Decane sessions, rendering the extra login button automatically via `customAuth: { label, getToken }`. So we build a small **KingsChat bridge issuer**:

1. User taps "Continue with KingsChat" → KingsChat OAuth (their `kingschat-web-sdk` flow).
2. Our bridge verifies the KingsChat access token against KingsChat's API and mints a short-lived **ES256 JWT** (`iss` = our bridge, `sub` = KingsChat user id) with a published JWKS.
3. Decane's `getToken` returns that JWT → Decane session + social wallet, same as any login.

Google and email stay available as Decane's built-ins on the same screen.

**Wallets.** The Decane social wallet exposes `addresses: { evm, solana }` with `signMessage` / `sendTransaction` / `signSolanaTransaction`; unlock is passkey-first with PIN fallback (`promptPin`), and `requireAssertionPerSignature` can force a fresh passkey assertion per signature (60s TTL, TEE-verified) for high-value flows. No server ever signs on the user's behalf.

**Backend session.** Client sends the Decane access token; backend verifies with **`decane-node`** (ES256; static verification key recommended — offline, no network call — or JWKS with auto-rotation), checks `project_id` against our app id, keys the user row off the stable `uid`, then issues our own short-lived JWT (LinkPay's token/middleware model). `decane-node` is explicitly the `@privy-io/node` drop-in, returning Privy-compatible `linkedAccounts`, which keeps the migration mechanical. Note: verification is stateless (signature + expiry + project only) — gate sensitive routes on a fresh backend check for immediate sign-out.

**⚠ Mobile-platform constraint (must resolve in Phase 1).** `decane-connect-kit` (2.5.0) is a **React 18 web SDK** — sessions in `localStorage`, device key-share in IndexedDB, WebAuthn passkeys. There is **no React Native/Expo package today**. Two viable integrations for our Expo app, in preference order:
1. **Hosted auth surface**: a minimal web page of ours runs Decane Kit (+ the KingsChat bridge); the app opens it with `expo-auth-session` / `expo-web-browser`, receives the Decane access token by deep link, and uses it against our backend. Wallet *signing* flows likewise run in that surface (in-app browser or WebView bridge) since the device share lives in its storage.
2. **Ask Decane for RN support / roadmap** — track as a dependency; adopt natively if it lands.

Onboarding after auth is unchanged: profile → PIN → passkey → done (LinkPay's `onboardingStep` machine).

**Packages:** `decane-connect-kit` 2.5.x (web auth surface), `decane-node` 1.1.x (backend), `kingschat-web-sdk` 0.1.x + our bridge issuer (KingsChat OAuth → ES256 JWT + JWKS).

### F2 — Account number per user · **PHASE 1, BUILD NOW**

- On onboarding completion (or first deposit intent), the backend provisions a **virtual account**: ensure provider customer (keyed by our userId as `customer_reference`) → create VA with a **stable per-user idempotency key** (`va<userId>v<version>`) so retries and concurrent calls can never mint duplicates → persist `vaId`, `vaAccountNumber`, `vaBankName` on the user.
- The version suffix in the idempotency key is the provider-migration escape hatch (LinkPay is on v2 after the 2026-07 Rubies migration); `previousVirtualAccounts` keeps retired numbers resolving to the user forever, because old numbers stay printed on invoices and saved in payers' banking apps.
- Surface: Receive screen shows account number + bank + copy button and a QR; @tag handles (3–15 chars, unique, cooldown-locked after rename) for in-app P2P.

### F3 — Fiat account: deposit, withdrawal, cross-border

- **Deposit**: bank transfer to the VA → provider webhook credits the ledger; push notification on arrival.
- **Withdrawal / send**: name-enquiry (account resolution) → PIN → payout via provider. Idempotency keys on every money-moving call; no timeouts on money-out POSTs (aborting manufactures ambiguous outcomes — retry safety comes from the idempotency key).
- **Cross-border**: two rails, chosen by corridor:
  - Provider payouts where supported (NG/GH/KE/ZA lineage from LinkPay).
  - **Worldstreet remit rail** (`/v1/payment` on the gateway): quote → corridor/bank pick → settles from **USDC on Base**. Pricing comes from the provider quote (spread baked in — never invent a client-side fee; that bug already happened once).
- Currency display: minor units end-to-end (kobo model), currency-tagged transactions.

### F4 — Crypto account: deposit & withdrawal (cross-chain)

- **Deposit**: show the user's static addresses (EVM / Solana / Tron / Bitcoin) with network picker + QR. Crypto arriving there → **optimistic fill** into fiat balance (§5). This is deposit-as-onramp.
- **Embedded wallets**: the Decane social-wallet ETH + SOL addresses hold on-chain assets for trading/games (Worldstreet perp margin, Last Man entries are on-chain plays). Balances shown in the crypto tab; USD-equivalent everywhere.
- **Withdrawal**: on-chain send from the social wallet (user signs via Decane, TEE-backed; `requireAssertionPerSignature` for high-value sends), or offramp crypto→fiat→bank. Gas sponsorship: Ark's flow used Privy's EIP-7702 authorization signing — Decane exposes message/tx/Solana signing but documents no 7702 support, so the sponsored-gas path needs rework or plain user-paid gas (§8).
- Refunds for failed conversions go to a configured refund address; failure states must be visible in activity, never silent.

### F5 — The optimistic-fill ledger (why balance feels instant)

The mechanism LinkPay runs in production, lifted as-is:

1. `optimistic_fill.crypto_received` — deposit confirmed on-chain, conversion in flight. Informational; UI may show "converting…".
2. `optimistic_fill.credited` — provider has converted; **we credit the user's fiat balance immediately**, keyed by `fillId` with an idempotent insert (a replayed webhook can't double-credit). Transaction row records `cryptoAmount`, `exchangeRate`, `optimisticFillId`.
3. `optimistic_fill.settled` — treasury→VA settlement lands later; **no action** (already credited). The settlement transfer has a non-user sender, so the generic bank-credit webhook path skips it — that's the double-credit guard.

Supporting cast: a reconcile job sweeps drift, a backfill job recovers rows lost to missed webhooks, `balanceAfterKobo` snapshots make statements truthful, and `feeKobo` is stamped at write time so future price changes can't re-price history. Unattributed webhooks are stored, never dropped.

**Primal decision:** reuse this exact design for both fiat and crypto legs. Single transaction collection, signed minor-unit amounts, `pending/completed/failed`, rich metadata.

### F6 — Copy trading (Worldstreet) · **⚠ MAJOR DEPENDENCY**

The one feature that exists nowhere yet. Ark already consumes the Worldstreet gateway (`api.worldstreetwebservices.com`) for perps (`/v1/perp`: pairs, quotes, build-tx, positions), so the plumbing pattern is known — but **copy trading needs new endpoints from the Worldstreet team**:

- Leader directory (trader profiles, PnL history, drawdown, win rate, AUM-following).
- Follow/unfollow with an allocation amount and per-follow risk caps (max position %, stop-copy on drawdown).
- Trade mirroring (server-side execution against follower allocation, or push-signed client execution — needs Worldstreet's call).
- Follower PnL and attribution feed.

**PRD stance:** design the UI now (directory → trader profile → follow sheet → my copies dashboard), integrate when endpoints land. Track this dependency explicitly in every sprint until resolved.

### F7 — Auto-earn Kash (Worldstreet rewards engine)

Kash (**KSH**) is Worldstreet's rewards token, live today in the web app (`wsws-frontend`, which shares the Ark identity) behind Privy auth:

- **Points-first weekly settlement**: activity earns **points** live, like XP ("points earn as you trade"); every **Saturday 00:00 UTC** the week's points convert to KSH once, at the settlement price, and **mint to the user's wallet**. Points and KSH balance are separate numbers and must never be conflated in the UI.
- No vesting lock — convertible always equals balance; claiming converts the wallet's accrued points at the current price. Ledger entry kinds: `points | settlement | purchase | conversion | locked-activity`.
- KSH is **on-chain** (token + controller contracts, permit-signature transfers), with a purchase desk (buy with USDC, min/max caps), redemption at a discount, peer send, and a **holding gate denominated in USD value of KSH** (so the gate holds as price moves, capped at 25%/day). Subscription tiers sit on top.
- Engine wire format: every amount is a **decimal string, max 6 dp** — the engine rejects JSON numbers. Keep amounts as strings end-to-end.
- **"Auto-earn" in Primal** = qualifying Primal activity (trades, game plays, remit — list TBC with Worldstreet) reports into the points engine automatically, and weekly settlement mints KSH with no user action. The web app reaches the engine through a same-origin proxy that holds the session gate; Primal (mobile) needs a direct gateway route.
- **⚠ Token-verification dependency**: Worldstreet's services (Kash engine, Earn `/v1/earn`, perp gateway auth) verify **Privy** access tokens today. With Primal on Decane, the gateway must additionally accept **Decane** tokens — mechanically easy on their side (`decane-node` is a drop-in beside `@privy-io/node`), but it's their change to make. Coordinate alongside the copy-trading endpoint ask (§7).

UI anchor (port from web): the **Kash card** — KSH balance on top, claimable points below with their USD worth beside them, holding-gate progress underneath.

### F8 — The Last Man Standing (game, $50 staking power)

Ported from Ark's live implementation:

- One pot, one clock. Paying the entry fee makes you the **last player** and resets the countdown; anyone can play after you and take your place; if the clock hits zero while you're last, **the whole pot is yours**.
- On-chain wagers from the embedded wallet; prizes are **claim-based**, not auto-credited — the UI must surface pending winnings. Ark pre-warms **gas-sponsor** endpoints so the first play isn't slow — that sponsorship rode on Privy's 7702 signing, so with Decane it needs a rework (§8) or user-paid gas at launch.
- Whiteboard spec: **$50 staking power** for Primal's flagship round (entry sizing/rounds to confirm with product).
- Ships inside a "Games" section (Ark's casino shelf: chess, checkers live today; same shelf can host more).

---

## 4. Platform & architecture

- **App**: this repo (Expo 57, expo-router, NativeWind, React Compiler). `src/app` route groups: `(onboarding)`, `(auth)`, `(tabs)` [Home · Trade · Earn · Games · Profile].
- **Backend**: new `primal-be` service cloned from `pouchpay-be`'s architecture (Bun + Express + Mongoose + Zod, module-per-domain, webhook module, reconcile/backfill jobs) — swap the auth module's root of trust to Decane token verification (`decane-node`), plus the small **KingsChat bridge issuer** (KingsChat OAuth verify → mint ES256 JWT, publish JWKS) which can live as a module inside `primal-be`.
- **Auth surface**: a minimal hosted web page running `decane-connect-kit` (login + wallet signing), opened from the app via `expo-auth-session` — required because Decane has no RN SDK today (§F1).
- **Providers**: Liquifia (VAs, payouts, static addresses, optimistic fill, bills), Worldstreet gateway (perp, remit, earn, prediction/RWA, games infra), Decane (identity + non-custodial social wallets), KingsChat (OAuth identity).
- **Known provider sharp edges** (encode in the service layer from day 1): Liquifia returns errors inside HTTP 200 envelopes; `error` is sometimes a string, sometimes an object; always capture `request_id`; idempotency keys on all money-out; timeouts on reads only.
- **Reference implementations**: `tsion` (Ark mobile — Privy setup, Worldstreet clients, games), `wsws-frontend` (Worldstreet web, shares the Ark identity — Kash engine client, perp/remit web flows), `pouchpay` + `pouchpay-be` (LinkPay — fiat rails, ledger, VA provisioning).

---

## 5. Design direction (for Claude Design)

**Client palette — build around these:**

| Token | Direction | Suggested start |
|---|---|---|
| Brand / action | **Lime green** | `#B4FF39` (electric lime; Ark's Last Man tint `#7BB026` is the muted cousin) |
| Money / positive | **Dollar green** | `#118C4F` (bill-green for credits, success, earn) |
| Canvas | **Metallic black** | `#0A0B0D` (Ark's proven dark canvas) with graphite elevation steps |
| Chrome / secondary | **Silver** | `#C7CCD1` metallic gradient accents, borders, inactive states |

- **Dark-first, metallic**: near-black canvas, silver hairlines, lime reserved for primary actions and the balance-affecting moments; dollar-green owns "money in" semantics (LinkPay learned the hard way that brand color and success color must be separate tokens).
- **Typography**: ClashDisplay for display/numbers + Geist for body (both already licensed and shipped in Ark; Geist Mono for amounts/addresses).
- Light theme optional at v1; dark is the brand.

**Screen inventory to design (priority order):**

1. Onboarding + auth (**KingsChat first-class**, Google, email; PIN create, passkey prompt)
2. Home: unified balance header (fiat + crypto toggle or stacked), activity feed with pending/optimistic states
3. Receive/Deposit sheet: account number + bank + QR ←→ crypto network picker + address QR
4. Send: @tag / bank / crypto-address flows with name-enquiry confirm + PIN
5. Cross-border: corridor picker → quote (provider-priced) → recipient bank → status timeline
6. Copy trading: leader directory → trader profile (PnL chart) → follow sheet (allocation + risk caps) → my copies
7. Earn: bounty feed → detail → my earnings ("Kash")
8. Games shelf + The Last Man screen (pot, countdown, last-player, play button, pending-claim banner)
9. Profile/settings: security (PIN, passkeys, devices, freeze, limits), account details

---

## 6. Phasing

| Phase | Scope | Definition of done |
|---|---|---|
| **1 — NOW** | Decane auth end-to-end (**KingsChat bridge** + Google/email, hosted auth surface) + backend session exchange + user model + **VA provisioning (account number per user)** + onboarding UI | Sign in with KingsChat on a device → see your own account number on the Receive screen |
| 2 | Fiat rails: deposit webhook → ledger → activity feed; send/withdraw with PIN; transaction history | Money in via bank transfer shows in-app in <10s; money out settles with idempotent safety |
| 3 | Crypto: static deposit addresses + optimistic fill + embedded-wallet balances + on-chain send | Crypto deposit credits fiat balance optimistically; failure → refund path visible |
| 4 | Cross-border (both rails) + Earn integration | Live corridor quote → payout; bounty feed authenticated by Decane token (needs §7.3) |
| 5 | Games (Last Man @ $50) + copy trading **(gated on Worldstreet endpoints)** | First round completes with real claims; first mirrored trade |

---

## 7. Dependencies & risks

1. **Worldstreet copy-trading API endpoints — MAJOR DEPENDENCY** (whiteboard, red underline). No endpoints exist today anywhere in our codebases. Owner + ETA needed; everything else in Primal can ship without it.
2. **Decane Kit has no React Native/Expo SDK** — Phase-1 blocker to resolve via the hosted auth surface (§F1) and/or Decane's roadmap. KingsChat also isn't a built-in Decane method; it requires our bridge issuer, which puts a small OAuth-verify + JWT-mint service on our critical path.
3. **Worldstreet services verify Privy tokens today** (Kash, Earn, sponsors) — they must add Decane token acceptance for Primal's integrations to work. Drop-in on their side via `decane-node`, but it's their change; bundle with the copy-trading ask.
4. Liquifia envelope/behavior quirks (documented in §4) — mitigated by porting LinkPay's hardened client verbatim.
5. VA provider migrations happen (Rubies, 2026-07) — the idempotency-key version scheme and `previousVirtualAccounts` design must be in Primal from day 1, not retrofitted.
6. Optimistic fill fronts money before settlement — treasury float monitoring + the reconcile job are launch requirements, not nice-to-haves.

## 8. Open questions

1. **Decane on mobile**: is an RN/Expo SDK on Decane's roadmap? Until then, does the hosted-auth-surface UX (system browser for login and signing) meet the bar, especially for frequent signers (Last Man players)?
2. **KingsChat OAuth details**: confirm the token-verification endpoint and claims the bridge can rely on (`kingschat-web-sdk` is v0.1.x), and whether KingsChat requires app review for OAuth clients.
3. **Gas sponsorship without Privy 7702**: does Decane plan EIP-7702/session-key support, or do Last Man plays launch with user-paid gas?
4. **Kash in Primal**: which Primal activities report points into the rewards engine, and can Worldstreet expose the engine directly on the gateway for mobile (the web app reaches it via a same-origin session proxy)?
5. Copy trading execution model: server-side mirroring vs. client-signed replication — Worldstreet's call, affects custody and UX.
6. Last Man entry structure at $50 staking power: fixed $50 entries, or $50 max per round?
7. Launch corridors/currencies for fiat (NG first? GH/KE/ZA at v1?) and KYC tiers (BVN at which tier?).
8. Does Primal share the LinkPay user base (linked accounts) or start clean? (Recommendation: start clean, offer LinkPay import later.)
