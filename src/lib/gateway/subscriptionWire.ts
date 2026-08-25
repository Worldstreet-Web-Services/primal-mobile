import {
  asPaymentStatus,
  asSubscriptionStatus,
  type CryptoPayment,
  type Money,
  type Subscription,
} from "./types";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * An integer from the wire, retained as a decimal string.
 *
 * Protobuf JSON can encode int64 fields as strings or numbers. A numeric value
 * is accepted only while JavaScript can represent it exactly; accepting an
 * unsafe number and stringifying it would preserve a rounded amount as though
 * it were authoritative.
 */
export function integerString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return /^-?\d+$/.test(trimmed) ? trimmed : null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return null;
}

/** A positive chain id from protobuf JSON, which may stringify int64 values. */
export function chainIdNumber(value: unknown): number | null {
  const raw = integerString(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function money(node: Record<string, unknown>, key: string): Money | undefined {
  const nested = record(node[key]);
  if (nested) {
    const amountMinor = integerString(nested.amountMinor);
    const currency = text(nested.currency);
    if (amountMinor && currency) return { amountMinor, currency };
  }

  // The deployed create response carries plan price fields directly on the
  // subscription. Accept both shapes at the boundary, not in components.
  if (key === "price") {
    const amountMinor = integerString(node.amountMinor);
    const currency = text(node.currency);
    if (amountMinor && currency) return { amountMinor, currency };
  }
  return undefined;
}

/** Subscription response envelope or entity to the app's typed boundary. */
export function readSubscription(raw: unknown): Subscription | null {
  const outer = record(raw);
  if (!outer) return null;
  const node = record(outer.subscription) ?? outer;
  const id = text(node.id);
  if (!id) return null;

  return {
    id,
    status: asSubscriptionStatus(node.status),
    price: money(node, "price"),
    userId: text(node.userId) ?? undefined,
    planCode: text(node.planCode) ?? undefined,
    currentPeriodStart: node.currentPeriodStart as Subscription["currentPeriodStart"],
    currentPeriodEnd: node.currentPeriodEnd as Subscription["currentPeriodEnd"],
    cancelAtPeriodEnd:
      typeof node.cancelAtPeriodEnd === "boolean" ? node.cancelAtPeriodEnd : undefined,
    createdAt: node.createdAt as Subscription["createdAt"],
    updatedAt: node.updatedAt as Subscription["updatedAt"],
  };
}

/** Payment response envelope or entity to the app's typed boundary. */
export function readPayment(raw: unknown): CryptoPayment | null {
  const outer = record(raw);
  if (!outer) return null;
  const node = record(outer.payment) ?? outer;
  const depositAddress = text(node.depositAddress);
  if (!depositAddress) return null;

  return {
    id: text(node.id) ?? "",
    subscriptionId: text(node.subscriptionId) ?? undefined,
    status: asPaymentStatus(node.status),
    provider: text(node.provider) ?? undefined,
    providerRequestId: text(node.providerRequestId) ?? undefined,
    depositAddress,
    originChainId: chainIdNumber(node.originChainId) ?? undefined,
    originAsset: text(node.originAsset) ?? undefined,
    originAmount: integerString(node.originAmount) ?? undefined,
    settlementChainId: chainIdNumber(node.settlementChainId) ?? undefined,
    settlementAsset: text(node.settlementAsset) ?? undefined,
    requiredSettlementAmount:
      integerString(node.requiredSettlementAmount) ?? undefined,
    quotedSettlementAmount:
      integerString(node.quotedSettlementAmount) ?? undefined,
    amountMinor: integerString(node.amountMinor) ?? undefined,
    currency: text(node.currency) ?? undefined,
    refundTo: text(node.refundTo) ?? undefined,
    expiresAt: node.expiresAt as CryptoPayment["expiresAt"],
    completedAt: node.completedAt as CryptoPayment["completedAt"],
    createdAt: node.createdAt as CryptoPayment["createdAt"],
    updatedAt: node.updatedAt as CryptoPayment["updatedAt"],
  };
}
