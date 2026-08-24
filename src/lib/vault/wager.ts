import { to7702SimpleSmartAccount } from "permissionless/accounts";
import {
  createClient,
  encodeFunctionData,
  http,
  type EIP1193Provider,
  type SignedAuthorization,
} from "viem";
import { createBundlerClient } from "viem/account-abstraction";
import { base } from "viem/chains";

import { liveBaseUrl } from "@/lib/deadHost";
import { publicClientFor } from "@/lib/evmClient";

import { VAULT_CONTRACT_ADDRESS } from "./api";

// On-chain side of the King of Night vault (v4, multi-game). Send rails
// ported from wsws-frontend (lib/trade/base-sponsor.ts +
// hooks/use-vault-actions.ts) via Ark; the contract surface follows the v4
// spec: anyone starts a game (startGame() payable — the stake becomes that
// game's minWager and the starter earns 10% at settlement), others join with
// wager(gameId) payable, expiry is settled permissionlessly via
// settle(gameId) with a 50/40/10 winner/treasury/starter split paid
// immediately, and failed transfers land in pendingWithdrawals to be pulled
// with claim(). Two send paths:
//   1. Sponsored (preferred): the embedded EOA is upgraded in place via
//      EIP-7702 to a Simple Account and the wager rides a UserOperation whose
//      gas Alchemy sponsors — routed through wsws's authenticated bundler
//      proxy so the API key/policy id stay server-side.
//   2. Direct fallback: if the proxy isn't reachable (e.g. not deployed yet),
//      the EOA sends a normal transaction and pays its own gas (cents on Base).
//
// Nothing here touches a wallet SDK: every signing capability arrives through
// the VaultSigner seam (src/lib/vault/signer.ts).

// Blanked when it points at the retired deployment (lib/deadHost.ts), which is
// where it is currently configured. `sponsorEndpoints` only lists this proxy
// when the URL is non-empty, so dropping it promotes the Alchemy sponsor to
// first choice instead of making every play wait out a dead host first.
export const BUNDLER_URL = liveBaseUrl(
  process.env.EXPO_PUBLIC_BASE_BUNDLER_URL,
);
const ALCHEMY_API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY ?? "";
const ALCHEMY_GAS_POLICY_ID =
  process.env.EXPO_PUBLIC_ALCHEMY_GAS_POLICY_ID ?? "";

export interface SponsorEndpoint {
  /** For logging/errors only. */
  name: string;
  url: string;
  headers: Record<string, string>;
}

/**
 * Sponsored-send endpoints in preference order. The auth-gated wsws proxy
 * keeps secrets server-side and is the production path; the direct Alchemy
 * endpoint embeds the key in the app bundle and exists so gasless plays work
 * in dev before the proxy is deployed — rotate the key before shipping.
 *
 * The endpoint that last completed a send is remembered and tried first:
 * the wsws host currently blackholes requests (hangs, no refusal), and
 * without this every single send re-paid the timeout walking the dead
 * endpoint before reaching the one that works.
 */
let lastGoodSponsorName: string | null = null;
/**
 * Sponsors that failed to answer this session. They are demoted rather than
 * dropped — an endpoint can come back — but a host that blackholes requests
 * must stop being the FIRST thing every send waits on.
 */
const deadSponsors = new Set<string>();

export function noteSponsorDown(name: string) {
  deadSponsors.add(name);
}

/** Dev-only pipeline timing — read these in Metro logs to see where a slow
 * send actually spends its time. */
export function tlog(label: string, sinceMs?: number): number {
  const now = Date.now();
  if (__DEV__) {
    console.log(
      `[wager] ${label}${sinceMs !== undefined ? ` +${now - sinceMs}ms` : ""}`,
    );
  }
  return now;
}

/**
 * Fire-and-forget health probe: races a cheap RPC against every sponsor
 * endpoint and remembers the first responder, so the first real send of a
 * session starts at a live endpoint instead of timing out against a dead
 * one. Call on screen mount — it finishes long before a human can tap Play.
 */
let probed = false;
export function warmSponsorEndpoints(accessToken: string): void {
  if (probed || lastGoodSponsorName) return;
  probed = true;
  for (const endpoint of sponsorEndpoints(accessToken)) {
    void (async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2_000);
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: { "content-type": "application/json", ...endpoint.headers },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_supportedEntryPoints",
            params: [],
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        // First live responder wins; preference order only breaks ties in
        // the same tick, which is fine — any live endpoint beats a dead one.
        if (res.ok && !lastGoodSponsorName) {
          lastGoodSponsorName = endpoint.name;
          tlog(`sponsor probe: ${endpoint.name} is live`);
        }
      } catch {
        // Dead or slow — exactly what the probe exists to discover.
      }
    })();
  }
}

export function sponsorEndpoints(accessToken: string): SponsorEndpoint[] {
  const endpoints: SponsorEndpoint[] = [];
  if (BUNDLER_URL) {
    endpoints.push({
      name: "wsws bundler proxy",
      url: BUNDLER_URL,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  if (ALCHEMY_API_KEY && ALCHEMY_GAS_POLICY_ID) {
    endpoints.push({
      name: "Alchemy direct",
      url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      headers: { "x-alchemy-policy-id": ALCHEMY_GAS_POLICY_ID },
    });
  }
  // Known-good first, known-dead last, everything else in declared order.
  const rank = (e: SponsorEndpoint) =>
    e.name === lastGoodSponsorName ? -1 : deadSponsors.has(e.name) ? 1 : 0;
  return endpoints.sort((a, b) => rank(a) - rank(b));
}

/**
 * Receipt polling gets its own, far more patient transport. It shares the
 * send transport's URL but none of its urgency: the operation is already
 * accepted by this point, so the only thing haste can achieve is falsely
 * reporting a landed play as lost.
 */
const RECEIPT_TIMEOUT_MS = 30_000;

/**
 * A failure that happened AFTER the operation was handed to the bundler.
 * Whether it was accepted is unknowable from here, so it must never be
 * retried on another endpoint: that is how one play becomes two payments.
 */
export class AmbiguousSend extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "AmbiguousSend";
  }
}

/**
 * The wallet never produced a signature, so NOTHING was submitted.
 *
 * `sendUserOperation` runs estimate → sign → submit in one call, and until
 * this existed every failure inside it was treated as an AmbiguousSend. That
 * is the safe default for a submit failure, but it is wrong for a signing
 * failure and expensively so: AmbiguousSend deliberately stops the endpoint
 * walk, so a wallet whose signer timed out could not fall through to the next
 * sponsor and simply failed every attempt, while the user was told to check
 * whether their money had moved. It had not — an unsigned operation cannot
 * reach a bundler.
 *
 * Definite failure, therefore safe to retry.
 */
export class SigningFailed extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "SigningFailed";
  }
}

/**
 * Whether a send blew up in the SIGNING step rather than at the bundler.
 *
 * Matched narrowly and only on shapes that can be produced before submission.
 * `user-signer:sign` is the wsws embedded-signer's operation name; a bare
 * "timeout" is deliberately NOT enough, because a bundler request can time
 * out after the operation is already in flight, which is the genuinely
 * ambiguous case this must not swallow.
 */
export function isSigningFailure(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e ?? "");
  return /user-signer:sign|failed to sign|signature (was )?(rejected|denied)|could not sign/i.test(
    message,
  );
}

/**
 * The bundler refused the operation at ESTIMATION, before anything was signed
 * or submitted. Nothing is in flight, so this is a CERTAIN failure and safe
 * to surface as one. "Insufficient funds" and AA21 prefund shortfalls arrive
 * here — mislabelling them ambiguous told users to go check for a payment
 * that could not exist.
 */
export class PreflightFailed extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "PreflightFailed";
  }
}

/**
 * The operation was accepted by the bundler but no receipt arrived in time.
 * NOT a failure: it usually lands moments later. Carries the userOp hash so
 * a caller can say something true instead of guessing.
 */
export class ReceiptPending extends Error {
  userOpHash: `0x${string}`;
  constructor(userOpHash: `0x${string}`) {
    super("Submitted, still confirming.");
    this.name = "ReceiptPending";
    this.userOpHash = userOpHash;
  }
}

/** Reference EIP-7702 Simple Account implementation on Base mainnet. */
const SIMPLE_7702_IMPL = "0xe6Cae83BdE06E4c305530e199D7217f42808555B" as const;

// v4 upgradeable proxy on Base — the address is stable across upgrades.
export const VAULT_ABI = [
  {
    type: "function",
    name: "startGame",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "wager",
    stateMutability: "payable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "nextGameId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "minStartStake",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "pendingWithdrawals",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getGameStatus",
    stateMutability: "view",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "pot", type: "uint256" },
      { name: "timeRemaining", type: "uint256" },
      { name: "king", type: "address" },
      { name: "starter", type: "address" },
      { name: "minWager", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "previewSplit",
    stateMutability: "view",
    inputs: [{ name: "pot", type: "uint256" }],
    outputs: [
      { name: "toWinner", type: "uint256" },
      { name: "toTreasury", type: "uint256" },
      { name: "toStarter", type: "uint256" },
    ],
  },
] as const;

export function contractAddress(): `0x${string}` {
  if (!VAULT_CONTRACT_ADDRESS) throw new Error("Vault isn't configured yet");
  return VAULT_CONTRACT_ADDRESS as `0x${string}`;
}

/** Read client pinned to Base — never the wallet's ambient provider, which
 * an embedded wallet may leave pointed at another chain. Alchemy-first with
 * public-RPC fallback via the shared per-chain factory. */
export function basePublicClient() {
  return publicClientFor(base);
}

// Contract reads, straight from the chain so amounts are exact even when the
// REST/socket lobby is a beat stale (the indexer trails by confirmation
// depth — the contract never does).

/** The chain-global floor for startGame() stakes. Worldstreet's config. */
export async function readMinStartStake(): Promise<bigint> {
  return basePublicClient().readContract({
    address: contractAddress(),
    abi: VAULT_ABI,
    functionName: "minStartStake",
  });
}

/** Prize money whose push-payment failed — pulled with claim(). */
export async function readPendingWithdrawals(
  address: `0x${string}`,
): Promise<bigint> {
  return basePublicClient().readContract({
    address: contractAddress(),
    abi: VAULT_ABI,
    functionName: "pendingWithdrawals",
    args: [address],
  });
}

export interface ChainGameStatus {
  active: boolean;
  pot: bigint;
  timeRemaining: bigint;
  king: `0x${string}`;
  starter: `0x${string}`;
  minWager: bigint;
}

export async function readGameStatus(gameId: number): Promise<ChainGameStatus> {
  const [active, pot, timeRemaining, king, starter, minWager] =
    await basePublicClient().readContract({
      address: contractAddress(),
      abi: VAULT_ABI,
      functionName: "getGameStatus",
      args: [BigInt(gameId)],
    });
  return { active, pot, timeRemaining, king, starter, minWager };
}

export function startGameCalldata(): `0x${string}` {
  return encodeFunctionData({ abi: VAULT_ABI, functionName: "startGame" });
}

export function joinCalldata(gameId: number): `0x${string}` {
  return encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "wager",
    args: [BigInt(gameId)],
  });
}

/** settle() is permissionless — anyone may trigger an expired game's payout. */
export function settleCalldata(gameId: number): `0x${string}` {
  return encodeFunctionData({
    abi: VAULT_ABI,
    functionName: "settle",
    args: [BigInt(gameId)],
  });
}

export function claimCalldata(): `0x${string}` {
  return encodeFunctionData({ abi: VAULT_ABI, functionName: "claim" });
}

export type SignAuthorization = (input: {
  contractAddress: `0x${string}`;
  chainId: number;
  nonce?: number;
}) => Promise<SignedAuthorization<number>>;

/**
 * Delegated accounts stay delegated: nothing in this app ever revokes the
 * 7702 code, so a `true` is cached for the session and the getCode call is
 * skipped on every later send. A `false` is never cached — that is the state
 * the very next send is expected to change.
 *
 * `forgetDelegation` exists so a send that fails on a stale assumption can
 * clear it rather than retrying into the same wrong answer forever.
 */
const delegated = new Set<string>();

/** Built once per wallet; see the note at its use site. */
const accountCache = new Map<
  string,
  Awaited<ReturnType<typeof to7702SimpleSmartAccount>>
>();

export function forgetDelegation(address: `0x${string}`) {
  delegated.delete(address.toLowerCase());
}

async function isAlreadyDelegated(address: `0x${string}`): Promise<boolean> {
  if (delegated.has(address.toLowerCase())) return true;
  const code = await basePublicClient().getCode({ address });
  const is =
    (code ?? "0x").toLowerCase() ===
    `0xef0100${SIMPLE_7702_IMPL.slice(2).toLowerCase()}`;
  if (is) delegated.add(address.toLowerCase());
  return is;
}

/**
 * Warm the reads a send will need, without sending anything. Called when a
 * screen that can spend mounts, so the tap path finds them already resolved.
 * Every failure is swallowed: this is an optimisation, never a gate.
 */
export function warmSendPath(address: `0x${string}`) {
  void isAlreadyDelegated(address).catch(() => {});
  void basePublicClient()
    .getTransactionCount({ address })
    .catch(() => {});
}

/** Errors that mean "the bundler proxy isn't there", not "the wager is bad" —
 * these are safe to retry on the direct self-paid path. */
export function isBundlerUnavailable(error: unknown): boolean {
  // Explicit, so none of these can ever be re-sent by the endpoint walk. A
  // PreflightFailed reverts identically on every endpoint — walking it just
  // delays the honest answer, and falling through to the self-paid path
  // would retry an operation that is known to fail.
  if (
    error instanceof AmbiguousSend ||
    error instanceof ReceiptPending ||
    error instanceof PreflightFailed
  ) {
    return false;
  }
  const message =
    error instanceof Error
      ? `${error.message}\n${String(error.cause ?? "")}`
      : String(error);
  return /404|405|502|503|Not Found|Failed to fetch|fetch failed|HTTP request failed|request has been canceled|Network request failed|timed? ?out|Unexpected (token|character)|HTML/i.test(
    message,
  );
}

/**
 * Sends a vault call as a gas-sponsored UserOperation from the user's own
 * embedded EOA (upgraded in place via EIP-7702 — same address, no migration).
 * Returns the confirmed transaction hash.
 */
export interface SponsoredCall {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
}

export async function sendSponsoredVaultCall({
  address,
  provider,
  signAuthorization,
  endpoint,
  to,
  data,
  value,
  calls,
  onAccepted,
}: {
  address: `0x${string}`;
  provider: EIP1193Provider;
  signAuthorization: SignAuthorization;
  endpoint: SponsorEndpoint;
  /** Defaults to the vault contract. */
  to?: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  /**
   * Multiple calls executed ATOMICALLY in one UserOperation, in order —
   * approve+trade as a single signature, so a stale allowance can never race
   * the trade it was meant to fund. Overrides to/data/value when present.
   */
  calls?: SponsoredCall[];
  /**
   * Fired the moment the bundler ACCEPTS the operation (validated and
   * simulated, but not yet on-chain). Lets callers show optimistic UI while
   * the receipt wait runs; the returned promise still resolves/rejects on
   * the real outcome.
   */
  onAccepted?: (userOpHash: `0x${string}`) => void;
}): Promise<`0x${string}`> {
  // Fetch the delegation check and the nonce together — the nonce is only
  // needed when not yet delegated, but the speculative read is one cheap
  // call and saves a round trip on every first play.
  let t = tlog(`send via ${endpoint.name}: preflight`);
  // Anything that reads as "this endpoint isn't there" demotes it for the
  // rest of the session; the caller's walk still decides what to do next.
  const noteIfDown = (e: unknown) => {
    if (isBundlerUnavailable(e)) noteSponsorDown(endpoint.name);
    return e;
  };
  const [delegated, nonce] = await Promise.all([
    isAlreadyDelegated(address),
    basePublicClient().getTransactionCount({ address }),
  ]);
  t = tlog("delegation+nonce", t);
  let authorization: SignedAuthorization<number> | undefined;
  if (!delegated) {
    authorization = await signAuthorization({
      contractAddress: SIMPLE_7702_IMPL,
      chainId: base.id,
      nonce,
    });
    t = tlog("7702 authorization signed", t);
  }

  // Fail fast on a dead endpoint: a healthy bundler answers estimation in
  // well under 2s, and the endpoint walk in the callers IS the retry.
  // viem's defaults (10s x 4 attempts, per RPC call) turned one hung proxy
  // into minutes of dead air before the fallback ever ran.
  // Dev-only per-call timing. viem's fetch hooks observe the transport
  // without touching what is sent, so this can measure the money path
  // without being able to alter it. The bundler's own methods are what we
  // are looking for: eth_estimateUserOperationGas is the usual cold cost.
  const pendingCalls = new Map<string, number>();
  const transport = http(endpoint.url, {
    fetchOptions: { headers: endpoint.headers },
    timeout: 6_000,
    retryCount: 0,
    ...(__DEV__
      ? {
          // Both hooks are SYNCHRONOUS and hand the parsing off to a
          // floating promise. viem awaits whatever a hook returns, so an
          // async hook would add its own latency to the very call it is
          // meant to be timing.
          onFetchRequest: (request: Request) => {
            const at = Date.now();
            void request
              .clone()
              .json()
              .then((body) => {
                const calls = Array.isArray(body) ? body : [body];
                for (const c of calls) {
                  if (c?.method) pendingCalls.set(String(c.id), at);
                }
                tlog(`rpc → ${calls.map((c) => c?.method).join(", ")}`);
              })
              .catch(() => {});
          },
          onFetchResponse: (response: Response) => {
            void response
              .clone()
              .json()
              .then((body) => {
                const calls = Array.isArray(body) ? body : [body];
                for (const c of calls) {
                  const started = pendingCalls.get(String(c?.id));
                  if (started) {
                    tlog(`rpc ← id ${c.id}`, started);
                    pendingCalls.delete(String(c.id));
                  }
                }
              })
              .catch(() => {});
          },
        }
      : {}),
  });
  const client = createClient({ chain: base, transport });
  // The account object is derived purely from address + implementation, so it
  // is the same object every time for a given wallet. Building it per send was
  // repeating that work on the critical path.
  const cachedAccount = accountCache.get(address.toLowerCase());
  const account =
    cachedAccount ??
    (await to7702SimpleSmartAccount({
      client: basePublicClient(),
      owner: provider,
    }));
  if (!cachedAccount) accountCache.set(address.toLowerCase(), account);
  t = tlog("smart account ready", t);
  const bundlerClient = createBundlerClient({
    account,
    client,
    chain: base,
    transport,
  });
  // Same endpoint, patient settings — see RECEIPT_TIMEOUT_MS.
  const receiptTransport = http(endpoint.url, {
    fetchOptions: { headers: endpoint.headers },
    timeout: RECEIPT_TIMEOUT_MS,
    retryCount: 2,
  });
  const receiptClient = createBundlerClient({
    account,
    client,
    chain: base,
    transport: receiptTransport,
  });

  t = tlog("bundler client ready", t);

  // Explicit estimation FIRST, alone. This is the last moment a failure is
  // still certain — nothing signed (viem estimates with a stub signature, so
  // the embedded signer's budget is untouched), nothing submitted. Without
  // this probe a semantic revert (no balance, AA21 prefund) surfaced inside
  // sendUserOperation and wore the ambiguous label, which is the one message
  // that must never be wrong. sendUserOperation re-estimates internally; the
  // duplicate read is the price of certainty on the money path.
  try {
    await bundlerClient.estimateUserOperationGas({
      calls: calls ?? [{ to: to ?? contractAddress(), data, value }],
      authorization,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      preVerificationGas: 0n,
    });
  } catch (e) {
    noteIfDown(e);
    // Transport-shaped failures keep their raw form so the caller's endpoint
    // walk (which IS the retry) can try the next sponsor. Everything else is
    // a certain refusal that would repeat identically anywhere.
    if (isBundlerUnavailable(e)) throw e;
    throw new PreflightFailed(e);
  }
  t = tlog("preflight estimation ok", t);

  // From here the operation is in flight. Everything below is wrapped so a
  // failure cannot be mistaken for "this endpoint is dead, try the next one".
  let hash: `0x${string}`;
  // One retry, and ONLY for a signing failure.
  //
  // Retrying a send is normally forbidden here — that is the whole point of
  // AmbiguousSend. It is safe in this one case because an operation that was
  // never signed was never submitted, so there is nothing in flight to
  // duplicate. Embedded signers time out intermittently
  // ("Operation reached timeout: user-signer:sign"), and without this a
  // single transient timeout failed the deposit outright.
  let attempt = 0;
  for (;;) {
    try {
      hash = await bundlerClient.sendUserOperation({
        calls: calls ?? [{ to: to ?? contractAddress(), data, value }],
        authorization,
        // The bundler fills these in for a sponsored operation; non-zero
        // values are what Alchemy's bundler-level sponsorship rejects.
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        preVerificationGas: 0n,
      });
      break;
    } catch (e) {
      // Estimation runs before this and fails fast on a genuinely dead
      // endpoint, so the endpoint walk still works — without gambling a
      // second payment on an ambiguous send.
      noteIfDown(e);
      if (isSigningFailure(e)) {
        // Definite failure: no signature, so no operation reached the
        // bundler. Retry once, then report it as the certain failure it is
        // rather than as something that might have gone through.
        if (attempt === 0) {
          attempt++;
          t = tlog("signer timed out, retrying once", t);
          continue;
        }
        throw new SigningFailed(e);
      }
      throw new AmbiguousSend(e);
    }
  }
  t = tlog("userOp estimated+signed+accepted", t);
  // Accepted the op — remember this endpoint so the next send starts here
  // instead of re-walking a dead one.
  lastGoodSponsorName = endpoint.name;
  onAccepted?.(hash);

  // Bounded wait: without a timeout a bundler hiccup here leaves the caller's
  // spinner waiting forever. On timeout the op may still land — say so
  // instead of implying failure. Base seals blocks every 2s; polling faster
  // than that only costs a few cheap reads and cuts the average wait by ~1s.
  let receipt;
  try {
    receipt = await receiptClient.waitForUserOperationReceipt({
      hash,
      timeout: 120_000,
      pollingInterval: 500,
    });
  } catch {
    // The bundler already accepted this operation, so "no receipt yet" is not
    // the same as "it failed" — and telling a user their play was lost when
    // it is merely slow is how they get talked into paying twice.
    tlog("receipt wait gave up (op may still land)");
    throw new ReceiptPending(hash);
  }
  tlog("userOp receipt", t);
  // A UserOperation can be INCLUDED and still revert. Without this check the
  // caller reads inclusion as success and reports a trade that never happened.
  if (receipt.success === false) {
    throw new Error("The transaction was included but reverted on-chain.");
  }
  return receipt.receipt.transactionHash;
}

/** Plain self-paid transaction through the wallet's provider. */
export async function sendDirectVaultCall({
  address,
  provider,
  to,
  data,
  value,
}: {
  address: `0x${string}`;
  provider: EIP1193Provider;
  /** Defaults to the vault contract. */
  to?: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}): Promise<`0x${string}`> {
  // The embedded provider may be pointed at another chain; pin it to Base.
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${base.id.toString(16)}` }],
    });
  } catch {
    // Older providers can lack the method; the send below will surface a
    // wrong-chain failure if switching genuinely didn't happen.
  }
  return (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: address,
        to: to ?? contractAddress(),
        data,
        value: `0x${value.toString(16)}`,
      },
    ],
  })) as `0x${string}`;
}

/** Base Flashblocks preconfirmation RPC: receipts appear here ~200ms after
 * the sequencer commits the transaction, a full block ahead of the sealed
 * chain. Public endpoint — used only for the short confirmation poll. */
const BASE_PRECONF_RPC = "https://mainnet-preconf.base.org";

/** Polls the Flashblocks endpoint at preconf cadence. Resolves with the
 * receipt status; rejects only at the deadline, so transport errors just
 * mean "keep trying" and never poison the race below. */
async function preconfReceiptStatus(
  hash: `0x${string}`,
  timeoutMs: number,
): Promise<"success" | "reverted"> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_PRECONF_RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_getTransactionReceipt",
          params: [hash],
        }),
      });
      const receipt = ((await res.json()) as { result?: { status?: string } })
        .result;
      if (receipt) return receipt.status === "0x0" ? "reverted" : "success";
    } catch {
      // Preconf endpoint hiccup — the standard client is still racing.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preconf timeout");
}

/** Waits for confirmation on Base; throws a friendly error on revert/timeout.
 * Races the Flashblocks preconf poll (sub-second) against the standard
 * client (2s blocks) — whichever answers first wins, and a dead preconf
 * endpoint costs nothing because both reject only at the same deadline. */
export async function awaitWagerReceipt(hash: `0x${string}`): Promise<void> {
  let status: "success" | "reverted";
  try {
    status = await Promise.race([
      basePublicClient()
        .waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          pollingInterval: 2_000,
        })
        .then((r) => r.status),
      preconfReceiptStatus(hash, 120_000),
    ]);
  } catch {
    throw new Error("Your play is taking long to confirm, check back shortly.");
  }
  if (status === "reverted") {
    throw new Error("Your play failed on-chain. Try again.");
  }
}
