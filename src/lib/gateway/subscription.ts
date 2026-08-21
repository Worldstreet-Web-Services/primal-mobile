/**
 * Membership: the subscription, its one crypto payment, and the idempotency key
 * that ties a checkout to exactly one of each.
 *
 * Three things in here are load-bearing, and each exists because the obvious
 * shortcut costs a user real money:
 *
 * 1. **The idempotency key is persisted before the request that uses it.** A
 *    timeout is not a failure. If `POST /v1/subscriptions` times out we do not
 *    know whether the gateway created a subscription, so the only safe next move
 *    is to send the SAME key again and let the gateway collapse the duplicate.
 *    Minting a second key there is how one membership becomes two. The key
 *    therefore survives an app kill, and is only discarded when the operation it
 *    named has genuinely concluded (settled, failed or expired).
 * 2. **A token symbol never comes off the wire.** `originAsset` is a contract
 *    address, not a ticker. The symbol and decimals shown beside an amount the
 *    user is about to send are resolved from `ORIGIN_NETWORKS` below — a fixed,
 *    reviewed table — or not shown at all. An address that does not resolve is a
 *    refusal, not a guess.
 * 3. **Nothing here decides entitlement.** A settled payment is a settled
 *    payment. Whether the account is entitled is a separate question, asked of
 *    the gateway by `entitlement.probeEntitlement()`, and answered only by it.
 *
 * Money stays in integer minor units as strings throughout, timestamps go
 * through `time.ts`, and the HTTP goes through `client.ts`. No second client, no
 * second money helper, no local float.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import * as client from "./client";
import * as entitlement from "./entitlement";
import { decimalsFor, formatMinor } from "./money";
import { millisUntil } from "./time";
import {
  ApiError,
  NetworkError,
  asPaymentStatus,
  asSubscriptionStatus,
  type CryptoPayment,
  type Money,
  type PaymentStatus,
  type Subscription,
  type SubscriptionStatus,
  type WireTimestamp,
} from "./types";

/* ------------------------------------------------------------------- price */

/**
 * The published membership price: USD 1,000 per month, as the gateway states it
 * — `amountMinor` in USD minor units. Screens format this; they never print a
 * hardcoded "$1,000". When a live subscription carries its own `price`, that one
 * wins: it is what this account is actually billed.
 */
export const MEMBERSHIP_PRICE: Money = { amountMinor: "100000", currency: "USD" };

/** What must land on the settlement chain: 1,000 USDC at 6dp. */
export const MEMBERSHIP_SETTLEMENT: Money = {
  amountMinor: "1000000000",
  currency: "USDC",
};

export const MEMBERSHIP_PERIOD = "month";

/** The price to show for a subscription, falling back to the published one. */
export const priceOf = (subscription: Subscription | null | undefined): Money =>
  subscription?.price ?? MEMBERSHIP_PRICE;

/* ------------------------------------------------- trusted origin networks */

export interface OriginAsset {
  /** Ticker for display. From this table only — never from a response field. */
  symbol: string;
  /** The token's own `decimals()`. The authority for formatting `originAmount`. */
  decimals: number;
  /** Contract address on the origin chain, as the gateway expects it. */
  address: string;
}

export interface OriginNetwork {
  chainId: number;
  /** What the user's wallet calls this network. */
  name: string;
  assets: readonly OriginAsset[];
}

/**
 * The networks and tokens a membership payment may originate from.
 *
 * Addresses are the canonical native USDC deployments, matching the repo's own
 * `src/lib/crypto/catalog.ts`. This table is the ONLY place a contract address
 * becomes a human-readable symbol. Extending it is a code review; a response
 * field claiming to be "USDC" is not.
 */
export const ORIGIN_NETWORKS: readonly OriginNetwork[] = [
  {
    chainId: 8453,
    name: "Base",
    assets: [
      {
        symbol: "USDC",
        decimals: 6,
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      },
    ],
  },
  {
    chainId: 1,
    name: "Ethereum",
    assets: [
      {
        symbol: "USDC",
        decimals: 6,
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      },
    ],
  },
  {
    chainId: 42161,
    name: "Arbitrum",
    assets: [
      {
        symbol: "USDC",
        decimals: 6,
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      },
    ],
  },
  {
    chainId: 10,
    name: "Optimism",
    assets: [
      {
        symbol: "USDC",
        decimals: 6,
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      },
    ],
  },
  {
    chainId: 137,
    name: "Polygon",
    assets: [
      {
        symbol: "USDC",
        decimals: 6,
        address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      },
    ],
  },
];

/** Base: the chain the wallet already signs on, so it is the default origin. */
export const DEFAULT_ORIGIN_CHAIN_ID = 8453;

export function networkFor(chainId: number | null | undefined): OriginNetwork | null {
  if (typeof chainId !== "number") return null;
  return ORIGIN_NETWORKS.find((n) => n.chainId === chainId) ?? null;
}

/**
 * The token at `address` on `chainId`, or `null`.
 *
 * Case-insensitive because EIP-55 checksumming is a display convention and the
 * gateway may echo a lowercased address; byte-for-byte otherwise.
 */
export function assetFor(
  chainId: number | null | undefined,
  address: string | null | undefined,
): OriginAsset | null {
  if (typeof address !== "string" || address === "") return null;
  const network = networkFor(chainId);
  if (!network) return null;
  const wanted = address.trim().toLowerCase();
  return network.assets.find((a) => a.address.toLowerCase() === wanted) ?? null;
}

export const defaultOriginAsset = (): OriginAsset =>
  // The table is a module constant with Base first; this cannot be undefined,
  // and a build that made it so should fail loudly here rather than silently
  // send a user's money to an unnamed asset.
  networkFor(DEFAULT_ORIGIN_CHAIN_ID)!.assets[0];

/* --------------------------------------------------------- payment reading */

/**
 * Everything a checkout screen may safely say about where the money goes.
 *
 * `safe` is the whole point: it is true only when the chain is one we know, the
 * asset resolved out of the trusted table, and the amount formatted cleanly. A
 * false here means the screen must not present a send instruction — an unknown
 * asset on an unknown chain is money sent nowhere.
 */
export interface OriginQuote {
  chainId: number | null;
  /** A name from the table, or an honest placeholder. Never invented. */
  networkName: string;
  network: OriginNetwork | null;
  asset: OriginAsset | null;
  /** The raw address, for the "verify this yourself" line. */
  assetAddress: string | null;
  /** Grouped, at the token's own decimals: `1,000.000000`. */
  amountText: string | null;
  /** The same figure with no separators — what a wallet field accepts. */
  amountPlain: string | null;
  safe: boolean;
}

/**
 * Format minor units with the trusted table's decimals.
 *
 * The shared money helper is keyed by currency code, and `CURRENCY_DECIMALS`
 * already carries USDC at 6. Cross-checking the two tables costs nothing and
 * catches the one failure that matters: an asset added here at the wrong
 * exponent would misstate the amount by a factor of a million.
 */
function formatAsset(
  amountMinor: string | null | undefined,
  asset: OriginAsset,
  grouping: boolean,
): string | null {
  if (typeof amountMinor !== "string" || amountMinor === "") return null;
  if (decimalsFor(asset.symbol) !== asset.decimals) return null;
  try {
    return formatMinor(amountMinor, asset.symbol, {
      fractionDigits: asset.decimals,
      grouping,
    });
  } catch {
    // Not an integer minor-unit string. Refusing beats printing NaN beside a
    // deposit address.
    return null;
  }
}

export function readOriginQuote(payment: CryptoPayment | null | undefined): OriginQuote {
  const chainId = typeof payment?.originChainId === "number" ? payment.originChainId : null;
  const network = networkFor(chainId);
  const asset = assetFor(chainId, payment?.originAsset);
  const amountText = asset ? formatAsset(payment?.originAmount, asset, true) : null;

  return {
    chainId,
    network,
    networkName: network?.name ?? (chainId === null ? "Unknown network" : `Chain ${chainId}`),
    asset,
    assetAddress: payment?.originAsset ?? null,
    amountText,
    amountPlain: asset ? formatAsset(payment?.originAmount, asset, false) : null,
    safe: Boolean(network && asset && amountText && payment?.depositAddress),
  };
}

/** The settlement leg, for the receipt line. Always USDC at 6dp per contract. */
export function readSettlementText(payment: CryptoPayment | null | undefined): string | null {
  if (typeof payment?.requiredSettlementAmount !== "string") return null;
  try {
    return `${formatMinor(payment.requiredSettlementAmount, "USDC")} USDC`;
  } catch {
    return null;
  }
}

/* -------------------------------------------------- address, read by a human */

/**
 * How many characters at each end a person is actually asked to compare.
 *
 * Six, not four: four-character collisions are cheap to grind, six is where the
 * vanity-generation cost starts to bite. It is a reading aid, not the check —
 * the check is the whole string, which is why nothing here ever elides one.
 */
export const ADDRESS_EDGE_CHARS = 6;

/**
 * A deposit address split into fixed-width groups.
 *
 * This exists because of address poisoning. The attack seeds a victim's
 * transaction history with an address whose first and last few characters match
 * a real one, and every interface that renders `0x8335…2913` makes the two
 * indistinguishable — the truncation IS the vulnerability. So the whole string
 * is always shown, chunked, so the eye can walk it against the wallet it was
 * pasted into instead of pattern-matching the ends.
 *
 * The `0x` rides on the first group rather than being counted into it, so the
 * groups line up with the same address seen in a block explorer.
 */
export function addressGroups(address: string, size = 4): string[] {
  const trimmed = address.trim();
  if (trimmed === "" || size < 1) return [];
  const prefix = /^0x/i.test(trimmed) ? trimmed.slice(0, 2) : "";
  const body = prefix ? trimmed.slice(2) : trimmed;
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += size) groups.push(body.slice(i, i + size));
  if (!prefix) return groups;
  return groups.length > 0 ? [prefix + groups[0], ...groups.slice(1)] : [prefix];
}

/**
 * The address as three parts, so a screen can weight the two ends a person is
 * being asked to check without ever dropping the middle.
 *
 * Short addresses (shorter than both edges together) come back whole in `head`:
 * splitting one into overlapping halves would show the same characters twice and
 * quietly turn a verification aid into a lie.
 */
export function addressEdges(address: string): {
  head: string;
  middle: string;
  tail: string;
} {
  const trimmed = address.trim();
  if (trimmed.length <= ADDRESS_EDGE_CHARS * 2) {
    return { head: trimmed, middle: "", tail: "" };
  }
  return {
    head: trimmed.slice(0, ADDRESS_EDGE_CHARS),
    middle: trimmed.slice(ADDRESS_EDGE_CHARS, -ADDRESS_EDGE_CHARS),
    tail: trimmed.slice(-ADDRESS_EDGE_CHARS),
  };
}

/* ------------------------------------------------------------------ tracing */

/**
 * One id tying every request of a single checkout attempt together in the
 * gateway's logs.
 *
 * Deliberately NOT an idempotency key, and deliberately not minted by
 * `client.newIdempotencyKey`: an idempotency key names an operation the gateway
 * may collapse, and confusing the two is exactly the mistake that turns one
 * membership into two. This names a *session of watching* — the create, then
 * every poll — and its only job is to give a user stuck in the entitlement gap
 * something support can search on besides a subscription id.
 */
export function newCheckoutTrace(): string {
  try {
    return `checkout-${Crypto.randomUUID()}`;
  } catch {
    // expo-crypto is a native module. A build without it must not take a
    // checkout down over a log header.
    return `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/* ------------------------------------------------------------ normalizers */

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function readMoney(node: Record<string, unknown>, key: string): Money | undefined {
  const raw = node[key] as Record<string, unknown> | undefined;
  if (raw && typeof raw === "object") {
    const amountMinor = str(raw.amountMinor);
    const currency = str(raw.currency);
    if (amountMinor && currency) return { amountMinor, currency };
  }
  // The create response states the price flat on the subscription rather than
  // nested; accept both so a shape change does not blank the paywall.
  const flatAmount = str(node.amountMinor);
  const flatCurrency = str(node.currency);
  if (key === "price" && flatAmount && flatCurrency) {
    return { amountMinor: flatAmount, currency: flatCurrency };
  }
  return undefined;
}

/**
 * Wire → `Subscription`. Unknown statuses become `UNKNOWN` rather than throwing:
 * a gateway that ships a new state tomorrow must not blank this screen.
 */
export function readSubscription(raw: unknown): Subscription | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const node = ((o.subscription as Record<string, unknown>) ?? o) as Record<string, unknown>;
  const id = str(node.id);
  if (!id) return null;

  return {
    id,
    status: asSubscriptionStatus(node.status),
    price: readMoney(node, "price"),
    currentPeriodStart: node.currentPeriodStart as Subscription["currentPeriodStart"],
    currentPeriodEnd: node.currentPeriodEnd as Subscription["currentPeriodEnd"],
    cancelAtPeriodEnd:
      typeof node.cancelAtPeriodEnd === "boolean" ? node.cancelAtPeriodEnd : undefined,
    createdAt: node.createdAt as Subscription["createdAt"],
    updatedAt: node.updatedAt as Subscription["updatedAt"],
  };
}

/**
 * Wire → `CryptoPayment`.
 *
 * `depositAddress` is required: a payment without one cannot be paid, and
 * rendering a checkout around a blank address invites a send to nowhere.
 */
export function readPayment(raw: unknown): CryptoPayment | null {
  const o = raw as Record<string, unknown> | null;
  if (!o || typeof o !== "object") return null;
  const node = ((o.payment as Record<string, unknown>) ?? o) as Record<string, unknown>;
  const depositAddress = str(node.depositAddress);
  if (!depositAddress) return null;

  return {
    id: str(node.id) ?? "",
    subscriptionId: str(node.subscriptionId) ?? undefined,
    status: asPaymentStatus(node.status),
    depositAddress,
    originChainId:
      typeof node.originChainId === "number" ? node.originChainId : undefined,
    originAsset: str(node.originAsset) ?? undefined,
    originAmount: str(node.originAmount) ?? undefined,
    requiredSettlementAmount: str(node.requiredSettlementAmount) ?? undefined,
    amountMinor: str(node.amountMinor) ?? undefined,
    currency: str(node.currency) ?? undefined,
    refundTo: str(node.refundTo) ?? undefined,
    expiresAt: node.expiresAt as CryptoPayment["expiresAt"],
    createdAt: node.createdAt as CryptoPayment["createdAt"],
  };
}

/* --------------------------------------------------------- status helpers */

/** No further movement is possible — stop polling. */
export function isTerminalPayment(status: PaymentStatus): boolean {
  return status === "SETTLED" || status === "FAILED" || status === "EXPIRED";
}

/** The window is open and the gateway is still watching for the transfer. */
export function isPayablePayment(status: PaymentStatus): boolean {
  return status === "AWAITING_TRANSFER" || status === "PROCESSING";
}

export function describePaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case "AWAITING_TRANSFER":
      return "Waiting for your transfer";
    case "PROCESSING":
      return "Transfer seen — confirming";
    case "SETTLED":
      return "Payment confirmed";
    case "FAILED":
      return "Payment failed";
    case "EXPIRED":
      return "Payment window closed";
    default:
      return "Checking with Primal";
  }
}

export function describeSubscriptionStatus(status: SubscriptionStatus): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Awaiting payment";
    case "ACTIVE":
      return "Active";
    case "PAST_DUE":
      return "Past due";
    case "GRACE_PERIOD":
      return "Grace period";
    case "CANCEL_AT_PERIOD_END":
      return "Ends at period end";
    case "EXPIRED":
      return "Expired";
    case "CANCELED":
      return "Canceled";
    case "REVOKED":
      return "Revoked";
    default:
      return "Unknown";
  }
}

/* ------------------------------------------------------- checkout intent */

/**
 * One intended checkout, with the key that names it.
 *
 * Persisted in SecureStore beside the session — not because it is a secret, but
 * because it must survive exactly as long as the session does and be wiped with
 * it. The record is written BEFORE the create request, so a crash between the
 * write and the response still finds the key on relaunch.
 */
export interface CheckoutIntent {
  idempotencyKey: string;
  originChainId: number;
  originAsset: string;
  refundTo: string;
  createdAt: number;
  /** Filled once the gateway has answered at least once. */
  subscriptionId: string | null;
}

const INTENT_KEY = "paradigm.gateway.checkout_intent";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.gateway",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const isWeb = Platform.OS === "web";

function isIntent(value: unknown): value is CheckoutIntent {
  const i = value as CheckoutIntent;
  return (
    typeof i === "object" &&
    i !== null &&
    typeof i.idempotencyKey === "string" &&
    i.idempotencyKey.length >= 8 &&
    typeof i.originChainId === "number" &&
    typeof i.originAsset === "string" &&
    typeof i.refundTo === "string"
  );
}

export async function loadIntent(): Promise<CheckoutIntent | null> {
  if (isWeb) return null;
  try {
    const raw = await SecureStore.getItemAsync(INTENT_KEY, OPTIONS);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function saveIntent(intent: CheckoutIntent): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(INTENT_KEY, JSON.stringify(intent), OPTIONS);
  } catch {
    // Storage refused. The key still holds for this launch, which covers the
    // retry-after-timeout case; only a relaunch mid-checkout loses it.
  }
}

/**
 * Discard the intent.
 *
 * Called ONLY when the operation it names has concluded: the payment settled,
 * failed, or its window closed. Never on a timeout, never on a transport error,
 * never because a screen unmounted — those are all cases where the same key must
 * be sent again.
 */
export async function clearIntent(): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(INTENT_KEY, OPTIONS);
  } catch {
    // Nothing to do.
  }
}

export interface CheckoutParams {
  originChainId: number;
  originAsset: string;
  /** Wallet that receives a refund if the route fails — the user's own. */
  refundTo: string;
}

/* ------------------------------------------------------------- endpoints */

export interface Checkout {
  subscription: Subscription;
  /** Absent when the gateway has a subscription but no payment leg for it. */
  payment: CryptoPayment | null;
  /** True when this is an existing checkout picked back up, not a new one. */
  resumed: boolean;
}

export function getSubscription(
  id: string,
  options?: { signal?: AbortSignal },
): Promise<Subscription | null> {
  return client
    .get<unknown>(`/v1/subscriptions/${encodeURIComponent(id)}`, {
      signal: options?.signal,
    })
    .then(readSubscription);
}

export function getPayment(
  subscriptionId: string,
  options?: { signal?: AbortSignal; correlationId?: string },
): Promise<CryptoPayment | null> {
  return client
    .get<unknown>(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}/payment`, {
      signal: options?.signal,
      correlationId: options?.correlationId,
    })
    .then(readPayment);
}

/** Both legs of one checkout. Creates nothing. */
export async function loadCheckout(
  subscriptionId: string,
  options?: { signal?: AbortSignal },
): Promise<Checkout | null> {
  const [subscription, payment] = await Promise.all([
    getSubscription(subscriptionId, options),
    // A subscription past its payment (or one whose payment leg 404s) must
    // still render its status, so a missing payment is not fatal here.
    getPayment(subscriptionId, options).catch((error) => {
      if (ApiError.is(error) && error.statusCode === 404) return null;
      throw error;
    }),
  ]);
  if (!subscription) return null;
  return { subscription, payment, resumed: true };
}

/**
 * Pick up a checkout this device already started, without creating anything.
 *
 * Used on launch and when the paywall opens: a user who killed the app mid-
 * payment must land back on the same deposit address, not be sold a second
 * membership.
 */
export async function resumeCheckout(options?: {
  signal?: AbortSignal;
}): Promise<Checkout | null> {
  const intent = await loadIntent();
  const id =
    intent?.subscriptionId ?? (await entitlement.getRememberedSubscriptionId());
  if (!id) return null;

  try {
    return await loadCheckout(id, options);
  } catch (error) {
    // Gone from the gateway's side: nothing to resume, and the key that named
    // it is spent. A fresh checkout is then a genuinely new operation.
    if (ApiError.is(error) && error.statusCode === 404) {
      await clearIntent();
      return null;
    }
    throw error;
  }
}

/**
 * Start (or re-send) a checkout.
 *
 * The sequence is deliberate:
 *
 * 1. An existing intent for the same parameters is REUSED, key and all. If it
 *    already names a subscription whose payment is still live, that checkout is
 *    returned untouched — no request that could create a second one.
 * 2. A concluded intent (settled/failed/expired payment) is cleared, and only
 *    then does a new key get minted.
 * 3. The new intent is written to storage BEFORE the POST, so a crash or a kill
 *    between the two leaves the key recoverable.
 * 4. The POST carries the key, which makes it replayable by the client: a
 *    timeout is retried with the same key rather than reported as a failure.
 *
 * Throws `ApiError` 409 when the gateway holds this key against different
 * parameters. That is not retried and not papered over with a fresh key — the
 * caller should resume, or ask the user to contact support.
 */
export async function startCheckout(
  params: CheckoutParams,
  options?: { signal?: AbortSignal },
): Promise<Checkout> {
  const existing = await loadIntent();

  if (existing && existing.subscriptionId) {
    const current = await loadCheckout(existing.subscriptionId, options).catch(
      (error) => {
        if (ApiError.is(error) && error.statusCode === 404) return null;
        throw error;
      },
    );

    if (current) {
      const status = current.payment?.status ?? "UNKNOWN";
      // Live, or already paid: hand it back rather than start anything.
      if (!current.payment || !isTerminalPayment(status) || status === "SETTLED") {
        return current;
      }
    }
    // Dead or missing: this operation is over, so the next one is new.
    await clearIntent();
  }

  // An intent still on disk with no `subscriptionId` is UNRESOLVED: the POST
  // went out and we never learned whether the gateway created a subscription
  // from it. It is reused whatever the caller now asks for — deliberately
  // ignoring `params` — because the only safe next move is to re-send the SAME
  // key with its ORIGINAL parameters and find out.
  //
  // Matching on parameters here was a double-charge: the sheet leaves the
  // network selector live while `payment` is null, so a member whose request
  // timed out could switch chain, fail the parameter check, and mint a second
  // key — a second subscription, a second deposit address, $1,000 charged twice.
  // A changed route is not a new operation while the previous one is unresolved.
  // If the gateway really does hold this key against different parameters it
  // answers 409, which `describeFailure` already narrates.
  const reusable = existing && !existing.subscriptionId ? existing : null;

  const intent: CheckoutIntent = reusable ?? {
    // The one place a key is minted. Everything else reuses what is on disk.
    idempotencyKey: client.newIdempotencyKey("sub"),
    originChainId: params.originChainId,
    originAsset: params.originAsset,
    refundTo: params.refundTo,
    createdAt: Date.now(),
    subscriptionId: null,
  };

  if (!reusable) await saveIntent(intent);

  const raw = await client.post<unknown>(
    "/v1/subscriptions",
    {
      idempotencyKey: intent.idempotencyKey,
      originChainId: intent.originChainId,
      originAsset: intent.originAsset,
      refundTo: intent.refundTo,
    },
    { signal: options?.signal },
  );

  const subscription = readSubscription(raw);
  if (!subscription) {
    throw new ApiError({
      statusCode: 502,
      message: "Primal accepted the request but returned no subscription.",
    });
  }
  const payment = readPayment(raw);

  await saveIntent({ ...intent, subscriptionId: subscription.id });
  await entitlement.rememberSubscriptionId(subscription.id);

  return { subscription, payment, resumed: false };
}

/**
 * Conclude the intent behind a checkout.
 *
 * Call exactly once, on a terminal payment status. After this a new checkout
 * mints a new key — which is right, because the next payment is a different
 * operation with a different deposit address.
 */
export async function concludeCheckout(status: PaymentStatus): Promise<void> {
  if (isTerminalPayment(status)) await clearIntent();
}

/**
 * Cancel a membership.
 *
 * `atPeriodEnd` is always sent explicitly. The DTO defaults it to `true`, and
 * letting a default decide whether someone keeps the month they paid for is not
 * a decision to leave to a serializer.
 */
export async function cancelSubscription(
  id: string,
  atPeriodEnd: boolean,
  options?: { signal?: AbortSignal },
): Promise<Subscription | null> {
  const raw = await client.post<unknown>(
    `/v1/subscriptions/${encodeURIComponent(id)}/cancel`,
    { atPeriodEnd },
    { signal: options?.signal },
  );
  return readSubscription(raw);
}

/* -------------------------------------------------------- polling policy */

/** Contract floor and ceiling for a visible checkout. */
export const POLL_VISIBLE_MIN_MS = 5_000;
export const POLL_VISIBLE_MAX_MS = 10_000;
/** Backgrounded: slowed, not stopped — a settle that lands there still shows. */
export const POLL_BACKGROUND_MS = 45_000;
const POLL_BACKOFF_BASE_MS = 5_000;
const POLL_BACKOFF_MAX_MS = 120_000;

/**
 * How long to wait before the next payment poll.
 *
 * Transport failures and 503s back off exponentially with jitter, so a gateway
 * coming back from an outage is not met by every client at once. Success
 * resets `failures` to 0 and the cadence returns to the 5–10s window.
 */
export function nextPollDelayMs(input: {
  visible: boolean;
  /** Consecutive failed polls. 0 after any success. */
  failures: number;
}): number {
  if (input.failures > 0) {
    const growth = POLL_BACKOFF_BASE_MS * 2 ** (input.failures - 1);
    const capped = Math.min(POLL_BACKOFF_MAX_MS, growth);
    // ±25%, so a fleet of retries spreads instead of re-synchronising.
    return Math.round(capped * (0.75 + Math.random() * 0.5));
  }
  if (!input.visible) return POLL_BACKGROUND_MS;
  return Math.round(
    POLL_VISIBLE_MIN_MS + Math.random() * (POLL_VISIBLE_MAX_MS - POLL_VISIBLE_MIN_MS),
  );
}

/**
 * The delay to use when the payment window closes sooner than the next poll
 * would fire. The contract asks for one final poll at expiry — a transfer that
 * lands in the last seconds is still a transfer, and the gateway is the one that
 * decides whether it counted.
 */
export function pollDelayBeforeExpiry(
  delayMs: number,
  expiresAt: WireTimestamp,
): number {
  const remaining = millisUntil(expiresAt);
  if (remaining === null) return delayMs;
  // +1s past the stated expiry: polling a hair early reads AWAITING_TRANSFER
  // and leaves the screen waiting for a poll that will never come.
  const finalPoll = remaining + 1_000;
  return finalPoll < delayMs ? finalPoll : delayMs;
}

/* ---------------------------------------------------------- failure copy */

export interface FailureNotice {
  title: string;
  detail: string;
  /** The id support needs. Never a token, never a body — safe to display. */
  correlationId: string | null;
  kind: "network" | "conflict" | "rate_limit" | "gateway" | "unknown";
  /** Whether the same action can simply be tried again. */
  retryable: boolean;
}

/**
 * Gateway failure → something a person can act on.
 *
 * Gateway 5xx text is written for operators ("User Management service is
 * unavailable"), so it is replaced wholesale; 4xx text is passed through,
 * because there the specific reason is the useful part.
 *
 * `SessionExpiredError` is deliberately NOT handled here — that is a routing
 * decision (sign in again), and callers must branch on it before reaching this.
 */
export function describeFailure(error: unknown): FailureNotice {
  if (NetworkError.is(error)) {
    return {
      title: error.timedOut ? "That took too long" : "No connection",
      detail: error.timedOut
        ? "Primal did not answer in time. Nothing was charged twice — trying again picks up the same checkout."
        : "Could not reach Primal. Check your connection and try again.",
      correlationId: error.correlationId,
      kind: "network",
      retryable: true,
    };
  }

  if (ApiError.is(error)) {
    if (error.statusCode === 409) {
      return {
        title: "Checkout already started",
        detail:
          "Primal is holding a different checkout under this device's key. Open the one in progress rather than starting another.",
        correlationId: error.correlationId,
        kind: "conflict",
        retryable: false,
      };
    }
    if (error.statusCode === 429) {
      return {
        title: "Too many requests",
        detail: "Primal is rate limiting this device. Wait a moment, then try again.",
        correlationId: error.correlationId,
        kind: "rate_limit",
        retryable: true,
      };
    }
    if (error.statusCode >= 500) {
      return {
        title: "Primal is unavailable",
        detail: "Something on Primal's side is down. Your checkout is safe — try again shortly.",
        correlationId: error.correlationId,
        kind: "gateway",
        retryable: true,
      };
    }
    return {
      title: "Primal refused that",
      detail: error.message,
      correlationId: error.correlationId,
      kind: "gateway",
      retryable: false,
    };
  }

  return {
    title: "Something went wrong",
    detail: "That did not complete. Try again.",
    correlationId: null,
    kind: "unknown",
    retryable: true,
  };
}

/* ------------------------------------------------------ entitlement sync */

/**
 * Bounded backoff for the wait between "payment confirmed" and "account
 * enabled". Roughly three minutes of asking, then the support state.
 *
 * Deliberately finite. An unbounded retry loop would sit there forever looking
 * busy, and the one thing a user in that position needs is an id to quote.
 */
export const SYNC_DELAYS_MS: readonly number[] = [
  1_000, 2_000, 4_000, 8_000, 15_000, 30_000, 30_000, 30_000, 30_000, 30_000,
];

export const SYNC_MAX_ATTEMPTS = SYNC_DELAYS_MS.length;

export const syncDelayMs = (attempt: number): number =>
  SYNC_DELAYS_MS[Math.min(attempt, SYNC_DELAYS_MS.length - 1)];

/**
 * One entitlement re-check, backend-answered.
 *
 * Thin on purpose: `probeEntitlement` is the app's single entitlement authority
 * and this only reports what it said. Nothing here writes a local "paid" flag,
 * because there is no such thing.
 */
export async function checkEntitled(options?: {
  signal?: AbortSignal;
}): Promise<boolean> {
  const snapshot = await entitlement.probeEntitlement({ signal: options?.signal });
  return snapshot.entitled;
}
