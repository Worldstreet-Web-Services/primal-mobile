# Primal — Product Requirements Document

**Version:** 0.6 — reconciled with the shipped app and the live backend
**Date:** 2026-08-16 (first drafted 2026-08-13)
**Status:** Living document. Where it disagrees with `https://api.tsion.io/openapi.json`, the gateway wins.
**Repo:** `Primal` (Expo SDK 57 · React Native 0.86 · expo-router · dev build, not Expo Go)

> **On the name.** The client renamed the app **KashPlus** on 2026-08-14 — that is what ships, and what every screen says. The backend, its gateway and its docs still say **Primal**, so both names appear here on purpose: *KashPlus* is the product, *Primal* is the platform/API it talks to. Worth settling before launch copy is written.

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

### F1 — Authentication (Decane + SIWE) · **BUILT**

Two layers, and the distinction matters: **Decane owns the wallet, the gateway owns the session.**

**Layer 1 — Decane (`decane-connect-kit-expo` 0.1.x, native).** Sign in with **KingsChat**, Google or email; the SDK mints a non-custodial wallet whose key is Shamir-split three ways (device / Decane key server / recovery) and signs inside a TEE, unlocked by passkey or PIN. It exposes `addresses: { evm, solana, tron }` plus `signMessage` / `sendTransaction` / `signAuthorization` (EIP-7702) / `signSolanaTransaction`. No server ever signs for the user. It is native-only, so the app runs as a **dev build, not Expo Go**.

**Layer 2 — Primal session (SIWE against `https://api.tsion.io`).** A wallet is not a session: `POST /v1/auth/challenge` → sign the **exact** message with the Decane EVM key → `POST /v1/auth/verify` → a short-lived access token plus a rotating refresh token. Refresh tokens rotate on every use, so the pair is replaced atomically and only ever one refresh is in flight. `GET /v1/auth/me` validates a restored session — a locally decoded JWT proves nothing.

**Onboarding after auth:** profile → PIN → passkey → done. The transaction PIN and biometric app-lock are KashPlus's own gate; Decane has no opinion about them.

**Known gap:** `EXPO_PUBLIC_DECANE_RP_ID` is unset, so the passkey tier is off and wallets sit on the secure-enclave tier. Setting it (plus iOS associated domains) turns passkeys on.

### F1b — Membership & entitlement · **REQUIRED BEFORE ANY MONEY FEATURE**

Access costs **USD 1,000 per calendar month**, and it is enforced server-side: every `/v1/linkpay/*` route needs a valid token **and** an active entitlement. Authentication and entitlement are separate decisions — a signed-in user with no subscription is a normal, expected state.

- **Checkout** (`POST /v1/subscriptions`) returns a **one-time deposit address** from Dextopus with a grossed-up `originAmount` and an expiry. Never the treasury address; never a shared address.
- **Confirmation is the backend's** (`GET /v1/subscriptions/{id}/payment` → `AWAITING_TRANSFER` → `PROCESSING` → `SETTLED`). A wallet transaction hash is not proof; the UI must never unlock itself on one.
- **Entitlement propagates asynchronously** after `SETTLED`, so a protected call can still 403 for a moment. That window gets its own state ("Payment confirmed. Enabling your account.") and a bounded retry — never a second checkout.
- **A 403 `ACTIVE_SUBSCRIPTION_REQUIRED` routes to the paywall, never to sign-in.** Expired entitlement is not expired authentication.
- **Renewal is explicit** — there is no automatic recurring debit. New month, new checkout, new idempotency key.

### F2 — Account number per user · **VIA GATEWAY**

- The account is provisioned through `POST /v1/linkpay/accounts` with KYC (name, phone, email, BVN, country, currency) and an **idempotency key that must survive retries** — the same key for the same attempt, a new key only for a genuinely new one. Statuses `PENDING_KYC` / `CUSTOMER_CREATED` are resumable, not terminal; `PROVISION_FAILED` carries a reason.
- **BVN is never logged, persisted, or sent to analytics** — form state only, long enough to submit.
- Read back with `GET /v1/linkpay/account`; balance from `GET /v1/linkpay/balance`. Money is integer **minor units as strings** (₦100.00 arrives as `"10000"`) — BigInt only, never float.
- Surface: Receive screen shows account number + bank + copy and a real scannable QR; @tag handles for in-app P2P remain a KashPlus-side concept.
- *(The idempotent-VA and retired-number lessons from LinkPay's own backend now live behind the gateway; the app no longer provisions accounts itself.)*
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
- **Backend**: the **Primal API Gateway** at `https://api.tsion.io` (contract: `/openapi.json`, which is authoritative over any document including this one). It fronts User Management, Subscription and LinkPay over private gRPC; the app never talks to those services, a database, a queue, or a provider directly. **KashPlus owns no backend of its own.**
- **Auth**: native `decane-connect-kit-expo` in the app (wallet + signing), SIWE against the gateway for the session (§F1). No hosted web surface, no bridge service — both were designed around constraints that no longer exist.
- **Providers, and who talks to them**: the gateway owns LinkPay (accounts, deposits, withdrawals, bills) and Dextopus (subscription checkout) with its own credentials. The app talks directly to the **Worldstreet/Ark rails** the gateway does not implement — perp, remit, earn, the King of Night vault (games) — and to public RPC/Alchemy for wallet balances.
- **Not implemented on the gateway** (per its own docs): ARK and WorldStreet product routes. Those stay app-side until the backend exposes them.
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

| Phase | Scope | Status |
|---|---|---|
| **1 — Auth** | Decane wallet (KingsChat/Google/email) + SIWE session against the gateway + PIN/passkey onboarding | **Done.** Signs in on a dev build; wallet addresses real; session survives cold launch. |
| **2 — Membership** | Subscription checkout ($1,000/mo, Dextopus deposit address), payment polling, entitlement-sync window, renewal | **In build.** Nothing behind the paywall works until this ships — it gates every LinkPay route. |
| **3 — Fiat** | KYC account provisioning, balance, deposits feed, bank withdrawal (validate → quote → initiate → poll) | **In build**, against the gateway. |
| **4 — Crypto** | Wallet balances (live), minted deposit addresses, spot buy/sell via Dextopus, on-chain send | Balances done; deposit + swap rails in build. Solana sends still refuse honestly. |
| **5 — Games** | Last Man Standing on the v4 vault, $50 stake policy, claims | Rails + screen done and live against the vault gateway; awaiting a first real round. |
| **6 — Bills & VAS** | Airtime, data, electricity, TV via the gateway | In build. |
| **7 — Worldstreet** | Copy trading, Earn/Kash | **Blocked**: no gateway routes, and copy-trading endpoints do not exist anywhere yet (§7.1). |

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
