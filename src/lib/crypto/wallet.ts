import { user } from "@/data/mock";

// The auth seam. Decane Kit (non-custodial ETH+SOL wallets, separate
// workstream) installs the real provider via setCryptoWallet; until then the
// stub serves the mock user's addresses for reads and refuses to sign.
// Nothing in this file may import Privy or Decane.

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

/** Mock-backed reads keep the demo real (public-RPC balance fetches run
 * against these addresses); sends refuse until the real provider lands. */
const stubWallet: CryptoWallet = {
  getAddresses: () => ({ evm: user.evm, solana: user.sol }),
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
