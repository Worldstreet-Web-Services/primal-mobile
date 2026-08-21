// The auth seam. Decane Kit installs the real provider via `setCryptoWallet`
// (see src/lib/auth/wire.ts); until it does, the stub reports NO wallet and
// refuses to sign. Nothing in this file may import Privy or Decane, and nothing
// here may import `@/data/mock` — a fabricated address is a fabricated balance.

export interface WalletAddresses {
  evm?: string;
  solana?: string;
}

/**
 * A transfer intent, not a raw transaction: the wallet implementation owns
 * ABI encoding (erc20 `transfer()`) and fee/gas handling, because that's
 * where the signer and its chain context live.
 */
export interface EvmSendRequest {
  chainId: number;
  /** Recipient of the funds — not the token contract. */
  to: string;
  /** null = native coin; otherwise the ERC-20 contract to transfer from. */
  tokenAddress: string | null;
  /** Base-unit amount (wei / token base units). */
  amountRaw: bigint;
}

export interface SolanaSendRequest {
  /** Recipient of the funds. */
  to: string;
  /** null = SOL; otherwise the SPL mint to transfer. */
  mint: string | null;
  /** Base-unit amount (lamports / token base units). */
  amountRaw: bigint;
}

export interface CryptoWallet {
  /** Null until a session exists. */
  getAddresses(): WalletAddresses | null;
  /** Signs (TEE, per-signature assertion for high value) and broadcasts. */
  sendEvm(req: EvmSendRequest): Promise<{ hash: string }>;
  sendSolana(req: SolanaSendRequest): Promise<{ signature: string }>;
}

export const WALLET_NOT_WIRED =
  "Sign-in isn't wired yet — withdrawals need your Decane wallet.";

/**
 * No wallet is no wallet. `getAddresses` returns null until Decane wires a real
 * one, and the difference between "null" and "someone else's address" is the
 * whole point.
 *
 * This used to serve `user.evm` / `user.sol` from `src/data/mock`, which cost
 * twice over. Those literals are malformed — the EVM one is 32 hex characters,
 * not 40 — so viem rejected them, every chain read failed, and the portfolio
 * store reported a read ERROR when the truth was that there was nothing to
 * read. Home could then never show a total: an entitled member with a real
 * naira balance got an em dash and a "could not read your wallets" retry that
 * structurally could not succeed.
 *
 * The second cost is the one that matters more. Had anyone ever replaced those
 * literals with a VALID address — an easy, well-meaning fix — the stub would
 * have handed every member the same wallet, and a stranger's on-chain balance
 * would have rendered as their own portfolio. Reads are not harmless just
 * because they are reads.
 */
const stubWallet: CryptoWallet = {
  getAddresses: () => null,
  sendEvm: async () => {
    throw new Error(WALLET_NOT_WIRED);
  },
  sendSolana: async () => {
    throw new Error(WALLET_NOT_WIRED);
  },
};

let wallet: CryptoWallet = stubWallet;

export function getCryptoWallet(): CryptoWallet {
  return wallet;
}

/** Decane Kit calls this once its session + signer are live (null reverts to
 * the stub on sign-out). Callers should refresh the portfolio store after —
 * the address set just changed. */
export function setCryptoWallet(next: CryptoWallet | null) {
  wallet = next ?? stubWallet;
}
