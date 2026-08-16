import { encodeFunctionData, erc20Abi, type EIP1193Provider } from "viem";

import { getClient } from "@/lib/auth/decane";
import { setCryptoWallet } from "@/lib/crypto/wallet";
import { setVaultSigner } from "@/lib/vault/signer";
import { usePortfolioStore } from "@/store/portfolio";

/**
 * Couples the Decane wallet to the two seams the app signs through: the vault
 * rails (Last Man plays, claims) and the crypto rails (withdrawals). Both were
 * built stubbed; this is the single file that makes them real, and the only
 * one that has to change if the wallet provider ever does again.
 *
 * Call `wireWallets()` whenever a session exists and `unwireWallets()` on sign
 * out — the seams fall back to their refusing stubs in between, so a signed-out
 * app fails with "sign in first" rather than a null dereference.
 */

/** Decane addresses chains as `evm:<id>` / `solana:mainnet` / `tron:mainnet`. */
const evmChain = (chainId: number) => `evm:${chainId}` as const;

/**
 * Minimal EIP-1193 shim over the SDK.
 *
 * The SDK has no provider of its own, and the vault rails only ever ask for
 * four methods: the account, the chain, a send, and the chain switch that the
 * direct (self-paid) path issues before pinning to Base. Anything else throws
 * by name rather than silently resolving undefined — a wallet that answers a
 * method it cannot honour is worse than one that admits it.
 */
function providerFor(chainId: number): EIP1193Provider {
  const request = async ({
    method,
    params,
  }: {
    method: string;
    params?: readonly unknown[];
  }): Promise<unknown> => {
    const client = await getClient();

    switch (method) {
      case "eth_accounts":
      case "eth_requestAccounts": {
        const evm = client.getAddresses()?.evm;
        return evm ? [evm] : [];
      }

      case "eth_chainId":
        return `0x${chainId.toString(16)}`;

      case "eth_sendTransaction": {
        const tx = (params?.[0] ?? {}) as {
          to?: string;
          value?: string | bigint;
          data?: string;
        };
        if (!tx.to) throw new Error("eth_sendTransaction needs a `to`.");
        return client.sendTransaction({
          chain: evmChain(chainId),
          to: tx.to,
          // Hex quantities on the wire, bigint in the SDK.
          value: tx.value == null ? undefined : BigInt(tx.value),
          data: tx.data,
        });
      }

      // The chain rides on every request, so there is nothing to switch to —
      // resolving null is what EIP-3326 specifies for an accepted switch.
      case "wallet_switchEthereumChain":
        return null;

      default:
        throw new Error(`Decane wallet doesn't implement ${method}.`);
    }
  };

  return { request } as unknown as EIP1193Provider;
}

/**
 * Point both seams at the live Decane wallet. Safe to call more than once.
 * Pass the session's addresses so reads work before the wallet is unlocked.
 */
export function wireWallets(addresses?: {
  evm?: string;
  solana?: string;
  tron?: string;
} | null): void {
  sessionAddresses = addresses ?? null;

  setVaultSigner({
    getAddress: async () => {
      // Signing genuinely needs the unlocked client, but the address itself
      // can come from the session when the wallet hasn't been opened yet.
      const evm = (await getClient()).getAddresses()?.evm ?? sessionAddresses?.evm;
      if (!evm) throw new Error("No EVM address on this session.");
      return evm as `0x${string}`;
    },

    getProvider: async () => providerFor(8453),

    // viem hands us { chainId, nonce, address | contractAddress }; the SDK
    // returns the r/s/yParity triple viem expects back, so this is a pass
    // through rather than a re-shape.
    signAuthorization: (async (parameters: {
      chainId?: number;
      nonce?: number;
      address?: string;
      contractAddress?: string;
    }) => {
      const client = await getClient();
      return client.signAuthorization({
        chainId: parameters.chainId ?? 8453,
        nonce: parameters.nonce ?? 0,
        address: parameters.address,
        contractAddress: parameters.contractAddress,
      });
      // The seam's type comes from viem; the SDK's SignedAuthorization is
      // structurally the same object.
    }) as never,

    // Synchronous in the SDK, promised at the seam.
    getAccessToken: async () => (await getClient()).getAccessToken(),
  });

  setCryptoWallet({
    getAddresses: () => {
      const a = clientAddresses();
      return a ? { evm: a.evm, solana: a.solana } : null;
    },

    sendEvm: async ({ chainId, to, tokenAddress, amountRaw }) => {
      const client = await getClient();
      const hash = await client.sendTransaction(
        tokenAddress
          ? {
              // ERC-20: the value rides in the calldata, and the recipient of
              // the transaction is the token itself.
              chain: evmChain(chainId),
              to: tokenAddress,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [to as `0x${string}`, BigInt(amountRaw)],
              }),
            }
          : { chain: evmChain(chainId), to, value: BigInt(amountRaw) },
      );
      return { hash };
    },

    // The SDK signs a Solana transaction but does not build or broadcast one,
    // and building it here means a blockhash fetch plus SPL account
    // derivation. Refuse honestly rather than ship untested money code.
    sendSolana: async () => {
      throw new Error(
        "Solana withdrawals aren't wired yet — send from an EVM chain for now.",
      );
    },
  });
}

/**
 * The resolved client, kept so the address getter can stay synchronous — the
 * SDK's own `getAddresses()` is sync, only `getClient()` is not.
 *
 * Read live rather than cached on purpose: a session restores while the wallet
 * is still LOCKED, and the addresses only become available after `unlock()`.
 * A one-shot cache taken at session time captures that null forever, which is
 * exactly what pinned the crypto screen to its offline preview.
 */
let liveClient: Awaited<ReturnType<typeof getClient>> | null = null;

/**
 * Addresses as the SESSION reports them — the source Profile already renders.
 * The client's own `getAddresses()` answers null until its wallet lock is
 * lifted, and that unlock is best-effort (AuthContext swallows its failure and
 * retries at signing time), so keying reads off the client left the balances
 * blind on every locked launch. Reads need no unlock; only signing does.
 */
let sessionAddresses: { evm?: string; solana?: string; tron?: string } | null =
  null;

function clientAddresses() {
  const fromClient = liveClient?.getAddresses() ?? null;
  if (fromClient?.evm) return fromClient;
  return sessionAddresses?.evm || sessionAddresses?.solana
    ? {
        evm: sessionAddresses.evm ?? "",
        solana: sessionAddresses.solana ?? "",
        tron: sessionAddresses.tron,
      }
    : null;
}

/**
 * Resolve the client and re-read balances. Called when a session lands AND
 * again once the app unlocks, since the wallet answers differently either
 * side of that line.
 */
export async function primeAddresses(): Promise<void> {
  try {
    liveClient = await getClient();
  } catch {
    liveClient = null;
  }
  usePortfolioStore.getState().refresh();
}

/** Drop back to the refusing stubs — sign-out, or a session that expired. */
export function unwireWallets(): void {
  liveClient = null;
  setVaultSigner(null);
  setCryptoWallet(null);
  // Drop the signed-in user's balances with their session — the next user must
  // never see the last one's figures while their own load.
  usePortfolioStore.getState().refresh();
}
