/**
 * "Can this person use Paradigm right now?" — answered by the backend, never
 * by us.
 *
 * The rule the contract is emphatic about: entitlement is whatever the gateway
 * says when we ask it for something entitled. Not a decoded JWT claim, not a
 * wallet transaction hash the user's phone watched confirm, not a flag we set
 * when a payment screen closed. A 403 is the signal; everything else here is
 * bookkeeping around that one fact.
 *
 * There is no "list my subscriptions" route on the gateway — only
 * `GET /v1/subscriptions/{id}`. So entitlement is discovered by *probing* an
 * entitled route, and the subscription id is remembered locally purely so a
 * half-finished payment can be recognised after the app restarts. That
 * remembered id is a hint for phrasing the UI. It is never evidence of access.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import * as client from "./client";
import { readSubscription } from "./subscriptionWire";
import {
  ApiError,
  SessionExpiredError,
  type PrimalAppState,
  type Subscription,
} from "./types";

/** The cheapest entitled route: no provider round trip, guard runs regardless. */
const PROBE_PATH = "/v1/linkpay/account";

const SUBSCRIPTION_KEY = "paradigm.gateway.subscription_id";
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "paradigm.gateway",
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
const isWeb = Platform.OS === "web";

/* --------------------------------------------------------- what a 403 means */

/**
 * The gateway refused this because the subscription is not live.
 *
 * `isEntitlementError` in `types.ts` insists on the literal word SUBSCRIPTION,
 * and the only 403 envelope this gateway has ever been observed to send —
 * `{statusCode, message, correlationId}`, with no `code` field — does not carry
 * it. So that predicate answers "no" to the exact refusal it was written for,
 * and the surface behind it shows a lapsed subscriber an operator error with a
 * Try again that can never succeed.
 *
 * Widened here, deliberately and only for the entitled surface: every
 * `/v1/linkpay/*` route sits behind the entitlement guard, which runs before
 * any lookup, so a 403 from one of them has exactly one meaning. Read it that
 * way rather than handing a paying user a dead tab.
 *
 * It cannot swallow a session failure, and that is the point of the two guards
 * below rather than a bare status check: a 401 is one serialized refresh and,
 * if the fresh token is refused too, a `SessionExpiredError` — neither is a
 * paywall, and parking an expired session behind one would leave the user
 * tapping "See the plan" for a subscription they already hold.
 */
export function isEntitlementRefusal(error: unknown): boolean {
  if (SessionExpiredError.is(error)) return false;
  if (!ApiError.is(error)) return false;
  return error.statusCode === 403;
}

/* --------------------------------------------- remembered subscription id */

export async function rememberSubscriptionId(id: string): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.setItemAsync(SUBSCRIPTION_KEY, id, OPTIONS);
  } catch {
    // Only costs us the ability to re-recognise a pending payment on relaunch.
  }
}

export async function getRememberedSubscriptionId(): Promise<string | null> {
  if (isWeb) return null;
  try {
    return await SecureStore.getItemAsync(SUBSCRIPTION_KEY, OPTIONS);
  } catch {
    return null;
  }
}

export async function forgetSubscriptionId(): Promise<void> {
  if (isWeb) return;
  try {
    await SecureStore.deleteItemAsync(SUBSCRIPTION_KEY, OPTIONS);
  } catch {
    // Nothing to do.
  }
}

/* ------------------------------------------------------------------ probe */

export interface EntitlementSnapshot {
  state: PrimalAppState;
  /** What the gateway actually allowed — the only load-bearing field. */
  entitled: boolean;
  /** `null` when we never got far enough to find out. */
  hasLinkpayAccount: boolean | null;
  /** Present only when a remembered subscription was readable. */
  subscription: Subscription | null;
  checkedAt: number;
}

async function fetchRememberedSubscription(
  signal?: AbortSignal,
): Promise<Subscription | null> {
  const id = await getRememberedSubscriptionId();
  if (!id) return null;
  try {
    return readSubscription(
      await client.get<unknown>(`/v1/subscriptions/${encodeURIComponent(id)}`, { signal }),
    );
  } catch (error) {
    if (SessionExpiredError.is(error)) throw error;
    // A 404 means it was never ours or has been purged — stop asking.
    if (ApiError.is(error) && error.statusCode === 404) {
      await forgetSubscriptionId();
    }
    return null;
  }
}

/**
 * Ask the gateway what this session may do.
 *
 * Throws only `SessionExpiredError` (the caller must route to sign-in) and
 * `NetworkError` (the caller should keep its previous state and retry, NOT
 * downgrade the user to unpaid because a request failed).
 */
export async function probeEntitlement(options?: {
  signal?: AbortSignal;
}): Promise<EntitlementSnapshot> {
  const checkedAt = Date.now();
  let entitled: boolean;
  let hasLinkpayAccount: boolean | null = null;

  try {
    await client.get<unknown>(PROBE_PATH, { signal: options?.signal });
    entitled = true;
    hasLinkpayAccount = true;
  } catch (error) {
    if (SessionExpiredError.is(error)) throw error;

    if (isEntitlementRefusal(error)) {
      entitled = false;
    } else if (ApiError.is(error) && error.statusCode === 404) {
      // Entitled, but no LinkPay account provisioned yet. The entitlement guard
      // runs ahead of the lookup, so reaching a 404 at all means we were let in.
      entitled = true;
      hasLinkpayAccount = false;
    } else {
      throw error;
    }
  }

  const subscription = await fetchRememberedSubscription(options?.signal).catch((error) => {
    if (SessionExpiredError.is(error)) throw error;
    return null;
  });

  return {
    state: deriveState({ entitled, subscription }),
    entitled,
    hasLinkpayAccount,
    subscription,
    checkedAt,
  };
}

/**
 * Fold the gateway's answer and the subscription record into one app state.
 * Pure — the probe does the asking, this does the reading.
 */
export function deriveState(input: {
  entitled: boolean;
  subscription: Subscription | null;
}): PrimalAppState {
  const status = input.subscription?.status ?? "UNKNOWN";

  if (input.entitled) {
    return status === "CANCEL_AT_PERIOD_END" ? "cancel_at_period_end" : "active";
  }

  switch (status) {
    case "PENDING_PAYMENT":
      return "payment_pending";

    // The subscription says paid, the gateway says no. That is propagation lag,
    // not a second bill — sit in a waiting state and re-probe.
    case "ACTIVE":
      return "entitlement_syncing";

    case "EXPIRED":
    case "CANCELED":
    case "REVOKED":
      return "expired";

    // PAST_DUE, GRACE_PERIOD, CANCEL_AT_PERIOD_END with no entitlement, or no
    // subscription at all: the gateway is the authority and it wants payment.
    default:
      return "authenticated_unpaid";
  }
}

/** States worth re-probing on a timer rather than leaving the user parked. */
export function isPending(state: PrimalAppState): boolean {
  return state === "entitlement_syncing" || state === "payment_pending";
}
