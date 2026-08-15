import { erc20Abi, isAddress } from "viem";

import {
  EVM_CHAINS,
  NATIVE_HOME,
  NETWORK_LABELS,
  TOKEN_CATALOG,
  type CatalogToken,
  type EvmNetworkId,
  type NetworkId,
} from "./catalog";
import { publicClientFor } from "@/lib/evmClient";
import { fetchPricesUsd } from "./prices";
import { formatAmount } from "./amounts";

// On-chain balance reads for the catalog, priced in USD. EVM chains read via
// viem public clients (native getBalance + one multicall of balanceOf);
// Solana reads via plain JSON-RPC fetch — same calls Ark makes through
// Alchemy — so no @solana/web3.js dependency is needed for reads.

const KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ?? "";
const SOL_TIMEOUT_MS = 12_000;
const SOL_RPC_URLS = [
  ...(KEY ? [`https://solana-mainnet.g.alchemy.com/v2/${KEY}`] : []),
  "https://api.mainnet-beta.solana.com",
];
const SPL_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/** One rounded cent — rows below this would render "$0.00", so they hide. */
export const DUST_FLOOR_USD = 0.005;

export interface Holding {
  symbol: string;
  name: string;
  network: NetworkId;
  /** Contract/mint address; null = native coin. */
  address: string | null;
  decimals: number;
  /** Lossy float for display. */
  balance: number;
  /** Exact base-unit integer string — use for "max" sends, never `balance`. */
  rawBalance: string;
  priceUsd: number;
  valueUsd: number;
  stable: boolean;
}

interface RawRow {
  token: CatalogToken;
  rawBalance: bigint;
}

function toFloat(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

async function evmNetworkRows(
  network: EvmNetworkId,
  owner: `0x${string}`,
): Promise<RawRow[]> {
  const client = publicClientFor(EVM_CHAINS[network]);
  const entries = TOKEN_CATALOG.filter((t) => t.network === network);
  const native = entries.find((t) => t.address === null);
  const tokens = entries.filter((t) => t.address !== null);

  const [nativeRaw, tokenResults] = await Promise.all([
    native ? client.getBalance({ address: owner }) : Promise.resolve(0n),
    tokens.length
      ? client.multicall({
          contracts: tokens.map((t) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [owner] as const,
          })),
          allowFailure: true,
        })
      : Promise.resolve([]),
  ]);

  const rows: RawRow[] = [];
  if (native && nativeRaw > 0n) rows.push({ token: native, rawBalance: nativeRaw });
  tokenResults.forEach((r, i) => {
    // A failed item read is a transient RPC issue, not a zero balance — skip
    // the token this round rather than quietly understating money.
    if (r.status !== "success") return;
    const raw = r.result as bigint;
    if (raw > 0n) rows.push({ token: tokens[i], rawBalance: raw });
  });
  return rows;
}

interface SolRpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

/** JSON-RPC against the first Solana endpoint that answers. Per-call errors
 * arrive INSIDE a 200 response, so `res.ok` proves nothing about the call
 * itself — unwrap and throw rather than defaulting to zero. */
async function solRpc<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: unknown = new Error("No Solana RPC configured");
  for (const url of SOL_RPC_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SOL_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Solana RPC ${res.status}`);
      const body = (await res.json()) as SolRpcResponse<T>;
      if (body.error) throw new Error(body.error.message ?? "rpc error");
      if (body.result === undefined) throw new Error("empty result");
      return body.result;
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function solanaRows(owner: string): Promise<RawRow[]> {
  const entries = TOKEN_CATALOG.filter((t) => t.network === "solana-mainnet");
  const native = entries.find((t) => t.address === null);
  const byMint = new Map(
    entries.filter((t) => t.address !== null).map((t) => [t.address as string, t]),
  );

  const [bal, accounts] = await Promise.all([
    solRpc<{ value: number }>("getBalance", [owner]),
    solRpc<{
      value: {
        account: {
          data: {
            parsed: { info: { mint: string; tokenAmount: { amount: string } } };
          };
        };
      }[];
    }>("getTokenAccountsByOwner", [
      owner,
      { programId: SPL_TOKEN_PROGRAM },
      { encoding: "jsonParsed" },
    ]),
  ]);

  const rows: RawRow[] = [];
  const lamports = BigInt(bal.value ?? 0);
  if (native && lamports > 0n) rows.push({ token: native, rawBalance: lamports });
  // An owner can hold several token accounts on the SAME mint (verified live:
  // one wallet, two USDC accounts) — sum per mint or the list shows dupes.
  const perMint = new Map<string, bigint>();
  for (const acct of accounts.value ?? []) {
    const info = acct.account.data.parsed.info;
    if (!byMint.has(info.mint)) continue; // uncataloged mints have no honest name
    const raw = BigInt(info.tokenAmount.amount);
    if (raw > 0n) perMint.set(info.mint, (perMint.get(info.mint) ?? 0n) + raw);
  }
  for (const [mint, raw] of perMint) {
    rows.push({ token: byMint.get(mint)!, rawBalance: raw });
  }
  return rows;
}

/**
 * Read every catalog balance for the given addresses and price it.
 *
 * One failing chain must not sink the rest — but null (not []) marks the
 * failure so a TOTAL failure can throw instead of reporting $0.00. An
 * invalid EVM address counts every EVM chain as failed for the same reason:
 * "couldn't read" must never come back as "empty wallet".
 */
export async function fetchHoldings(
  evm: string | null,
  solana: string | null,
): Promise<Holding[]> {
  const jobs: Promise<RawRow[] | null>[] = [];
  if (evm) {
    if (isAddress(evm)) {
      for (const network of Object.keys(EVM_CHAINS) as EvmNetworkId[]) {
        jobs.push(evmNetworkRows(network, evm).catch(() => null));
      }
    } else {
      jobs.push(Promise.resolve(null));
    }
  }
  if (solana) jobs.push(solanaRows(solana).catch(() => null));
  if (jobs.length === 0) throw new Error("No wallet addresses to read");

  const results = await Promise.all(jobs);
  if (results.every((r) => r === null)) {
    throw new Error("Every chain read failed");
  }

  const rows = results.filter((r): r is RawRow[] => r !== null).flat();
  const prices = await fetchPricesUsd(rows.map((r) => r.token.symbol));

  const holdings: Holding[] = rows
    .map((r) => {
      const priceUsd = prices[r.token.symbol] ?? 0;
      const balance = toFloat(r.rawBalance, r.token.decimals);
      return {
        symbol: r.token.symbol,
        name: r.token.name,
        network: r.token.network,
        address: r.token.address,
        decimals: r.token.decimals,
        balance,
        rawBalance: r.rawBalance.toString(),
        priceUsd,
        valueUsd: balance * priceUsd,
        stable: r.token.stable ?? false,
      };
    })
    .filter((h) => h.valueUsd >= DUST_FLOOR_USD)
    .sort((a, b) => b.valueUsd - a.valueUsd);
  return holdings;
}

/** Whether a row needs its network spelled out ("· Base"): every token row,
 * and native coins living off their home chain. */
export function needsNetworkSuffix(h: Pick<Holding, "symbol" | "network" | "address">): boolean {
  return h.address !== null || NATIVE_HOME[h.symbol] !== h.network;
}

/** "0.031 ETH" / "130.00 USDC · Base" — the qty line under a holding row. */
export function holdingQtyLabel(h: Holding): string {
  const qty = h.stable ? h.balance.toFixed(2) : formatAmount(h.balance);
  const suffix = needsNetworkSuffix(h) ? ` · ${NETWORK_LABELS[h.network]}` : "";
  return `${qty} ${h.symbol}${suffix}`;
}
