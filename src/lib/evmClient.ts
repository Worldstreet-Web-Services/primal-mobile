import { createPublicClient, fallback, http, type Chain } from "viem";

// One shared read client per chain, Alchemy-first with a public-RPC safety
// net. The chains' default public endpoints rate-limit hard enough to surface
// as "RPC failed" mid-flow in money paths; the bundled Alchemy key serves
// every network below. Cached per chain so viem reuses the transport across
// calls.
const KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ?? "";

/** viem chain id → Alchemy RPC subdomain. */
const ALCHEMY_NETWORK: Record<number, string> = {
  1: "eth-mainnet",
  10: "opt-mainnet",
  137: "polygon-mainnet",
  8453: "base-mainnet",
  42161: "arb-mainnet",
};

function makeClient(chain: Chain) {
  const network = ALCHEMY_NETWORK[chain.id];
  const transports = [
    ...(KEY && network
      ? [
          http(`https://${network}.g.alchemy.com/v2/${KEY}`, {
            timeout: 10_000,
            retryCount: 2,
          }),
        ]
      : []),
    http(undefined, { timeout: 10_000, retryCount: 2 }),
  ];
  return createPublicClient({
    chain,
    transport: transports.length > 1 ? fallback(transports) : transports[0],
  });
}

const clients = new Map<number, ReturnType<typeof makeClient>>();

/** Read client pinned to `chain` — never a wallet's ambient provider, which
 * may be pointed at another network. */
export function publicClientFor(chain: Chain) {
  let client = clients.get(chain.id);
  if (!client) {
    client = makeClient(chain);
    clients.set(chain.id, client);
  }
  return client;
}
