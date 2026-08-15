# Decane auth → app integration contract

For whoever implements Decane Kit auth. The games and crypto stacks are
already live against real backends; they sign through two small seams. Auth's
entire integration surface is **implementing these two interfaces and calling
their setters once after sign-in** (and again with `null`/refresh on
sign-out). Nothing else in the app changes.

Until these are set, every read works (live lobby, live balances once real
addresses exist) and every write fails softly with
*"Sign-in isn't wired yet…"*.

---

## 1. Games — `src/lib/vault/signer.ts`

```ts
import { setVaultSigner, type VaultSigner } from "@/lib/vault/signer";

setVaultSigner({
  // The user's EVM address (Base, chainId 8453).
  getAddress(): Promise<`0x${string}`>,

  // EIP-1193 provider for the embedded wallet. Must answer
  // eth_sendTransaction (self-paid fallback path) and ideally
  // wallet_switchEthereumChain. Used as the 7702 smart-account owner.
  getProvider(): Promise<EIP1193Provider>,

  // EIP-7702 authorization signing — gas-sponsored plays delegate the EOA
  // to a smart account. viem's SignAuthorization shape.
  signAuthorization(auth): Promise<SignedAuthorization>,

  // Bearer for the wsws bundler/sponsor proxy. Return null if the session
  // has none; sponsorship then falls back to self-paid.
  getAccessToken(): Promise<string | null>,
});
```

Used by: `startGame()` / `wager(gameId)` / `claim()` on the King of Night
vault (v4 proxy `0x202Af4dB1F742782709873040Afd6c99190E2684`, Base 8453).
Plays are floored at **$50** (`PLAY_TARGET_USD` in `src/lib/vault/format.ts`)
for Paradigm-started games.

## 2. Crypto — `src/lib/crypto/wallet.ts`

```ts
import { setCryptoWallet } from "@/lib/crypto/wallet";
import { usePortfolioStore } from "@/store/portfolio";

setCryptoWallet({
  // Both addresses from the Decane social wallet. Balances/holdings light
  // up the moment this returns real values (reads are public-RPC).
  getAddresses(): { evm?: `0x${string}`; solana?: string } | null,

  // Transfer INTENTS — ABI encoding, gas and fees live with the signer.
  // tokenAddress/mint null ⇒ native asset. amountRaw is base units (string).
  sendEvm({ chainId, to, tokenAddress, amountRaw }): Promise<{ hash: string }>,
  sendSolana({ to, mint, amountRaw }): Promise<{ signature: string }>,
});

// After install AND after sign-out:
usePortfolioStore.getState().refresh();
```

Used by: the Crypto space (balances/holdings), Withdraw (on-chain sends),
Receive (address display is separate — static deposit addresses come from
LinkPay rails via primal-be, not the wallet).

## Notes

- Both stubs throw a user-facing message from every method; the hooks gate on
  the address getters first, so that message always outranks pricing/RPC
  errors. Keep that property if you wrap them.
- The vault backend never signs or holds keys — writes go straight from the
  user's wallet to the contract (the spec names Privy/Dynamic; Decane fills
  the same client-side role).
- Ark's Privy-specific 7702 raw-hash fallback was deliberately not ported; if
  Decane's `signAuthorization` needs a fallback path, it belongs inside your
  implementation of the seam.
- Backend session exchange (`primal-be`): verify the Decane access token with
  `decane-node`, key the user row off the stable `uid`, mint our session JWT
  — the middleware seam is documented in `primal-be/src/middleware/auth.middleware.ts`.
