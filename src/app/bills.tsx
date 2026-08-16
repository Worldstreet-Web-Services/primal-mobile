import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  AbortedError,
  ApiError,
  isEntitled,
  isEntitlementError,
  isTerminalTransfer,
  NetworkError,
  SessionExpiredError,
} from "@/lib/gateway";
import {
  releaseIdempotencyKey,
  reserveIdempotencyKey,
} from "@/lib/gateway/linkpay";
import { SIGN_IN_ROUTE } from "@/lib/routes";
import {
  discoverCatalog,
  listProducts,
  pollTransaction,
  purchase,
  purchaseSlot,
  type PurchaseIntent,
  type VasCategory,
  type VasProduct,
  type VasProvider,
  type VasTransaction,
} from "@/lib/gateway/services";
import BillCheckoutScreen, { type CheckoutPhase } from "@/screens/BillCheckoutScreen";
import BillsScreen, { type BillDraft, type BillsBlock } from "@/screens/BillsScreen";
import { C } from "@/theme/tokens";

/**
 * Bills — value-added services on LinkPay.
 *
 * This route owns everything stateful: the catalogue sweep, the product fetch,
 * the idempotency key, the purchase, and the poll that follows it. Both screens
 * below are presentational.
 *
 * Two rules it exists to enforce.
 *
 * **403 is not 401.** Every route under `/v1/linkpay/*` needs a live token AND
 * an active entitlement. A 401 the client could not refresh arrives as
 * `SessionExpiredError` and means sign in; a 403 means the person is signed in
 * perfectly well and has not paid, and goes to the subscription screen — which
 * belongs to another workstream, so all this does is call the callback.
 *
 * **One key per intended purchase.** The key is reserved against a slot derived
 * from the intent itself (`purchaseSlot`), so retrying the same purchase — after
 * a timeout, a crash, or a relaunch — reserves the same key, and changing the
 * amount or the number cannot reuse a spent one. A timeout is never treated as
 * a failure: the retry path re-sends, it does not re-mint.
 */
/**
 * What has to be true before this route may ask for a catalogue at all.
 *
 * `waiting` is the only honest answer while the gateway layer is still deciding
 * — and `stalled` is the one that stops "still deciding" from being forever,
 * which is exactly what happens when the auth service is down and `primal.state`
 * never leaves `unknown`.
 */
type Gate = "ready" | "waiting" | "stalled" | "signin" | "subscription";

function gateFor(
  state: ReturnType<typeof useAuth>["primal"],
  signedOut: boolean,
): Gate {
  if (state.state === "session_expired") return "signin";
  if (state.syncing) return "waiting";
  if (state.state === "unknown") return state.error ? "stalled" : "waiting";
  if (state.state === "anonymous") return signedOut ? "signin" : "stalled";
  // Paid but not propagated yet, and a payment mid-flight, are both "hold on"
  // rather than "you cannot" — sending someone who has just paid to the paywall
  // is the worst version of this screen.
  if (state.state === "entitlement_syncing" || state.state === "payment_pending") {
    return "waiting";
  }
  return isEntitled(state.state) ? "ready" : "subscription";
}

export default function Bills() {
  const { primal, status, linkPrimal, refreshEntitlement } = useAuth();
  const toast = useToast();
  const [headerHeight, setHeaderHeight] = useState(0);

  /* --------------------------------------------------------- the catalogue */

  const [categories, setCategories] = useState<VasCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState<BillsBlock>(null);

  /* ------------------------------------------------------------- products */

  const [products, setProducts] = useState<VasProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  /* ------------------------------------------------------------- checkout */

  const [draft, setDraft] = useState<BillDraft | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase>("confirm");
  const [transaction, setTransaction] = useState<VasTransaction | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  /** The slot whose key is currently spent-or-spending. Released on terminal. */
  const slotRef = useRef<string | null>(null);
  /** Guards the confirm handler itself, not just the button. */
  const inFlightRef = useRef(false);

  const gate = gateFor(primal, status === "signedOut");

  /* ------------------------------------------------------------ failures */

  /**
   * Turn a thrown thing into either a routing decision or a sentence.
   * Returns the sentence, or null when it already routed.
   */
  const describe = useCallback((e: unknown): string | null => {
    if (SessionExpiredError.is(e)) {
      router.replace(SIGN_IN_ROUTE);
      return null;
    }
    if (isEntitlementError(e)) {
      setBlock("subscription");
      return null;
    }
    if (NetworkError.is(e)) {
      return e.timedOut
        ? "Paradigm took too long to answer."
        : "Could not reach Paradigm. Check your connection.";
    }
    if (ApiError.is(e)) {
      return e.statusCode >= 500
        ? "The biller network is temporarily unavailable. Try again shortly."
        : e.message;
    }
    return "Something went wrong.";
  }, []);

  /* ------------------------------------------------------------- discovery */

  const load = useCallback(
    async (signal: AbortSignal, force = false) => {
      setLoading(true);
      setError(null);
      const found: VasCategory[] = [];
      try {
        await discoverCatalog({
          signal,
          force,
          // Each shelf paints as it lands rather than after all nine probes.
          onCategory: (category) => {
            found.push(category);
            setCategories([...found]);
          },
        });
        setBlock(null);
      } catch (e) {
        if (AbortedError.is(e) || signal.aborted) return;
        const message = describe(e);
        if (message) setError(message);
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [describe],
  );

  useEffect(() => {
    if (gate === "signin") {
      router.replace(SIGN_IN_ROUTE);
      return;
    }
    // Skeletons, and only while something is genuinely still moving.
    if (gate === "waiting") {
      setLoading(true);
      setError(null);
      return;
    }
    // The gateway layer gave up without deciding. Say the reason it gave and
    // offer the handshake again — a permanent skeleton is a lie.
    if (gate === "stalled") {
      setLoading(false);
      setError(primal.error ?? "Could not reach Paradigm. Check your connection.");
      return;
    }
    // Nothing under /v1/linkpay/* will answer without an entitlement, so an
    // unentitled account is told outright instead of being shown nine 403s.
    if (gate === "subscription") {
      setBlock("subscription");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [gate, primal.error, load]);

  const retryCatalog = useCallback(() => {
    if (gate === "stalled") {
      void linkPrimal();
      return;
    }
    if (gate === "waiting") {
      void refreshEntitlement();
      return;
    }
    const controller = new AbortController();
    void load(controller.signal, true);
  }, [gate, linkPrimal, refreshEntitlement, load]);

  /* -------------------------------------------------------- product fetch */

  const productRun = useRef(0);

  const onProviderSelected = useCallback(
    (category: VasCategory, provider: VasProvider) => {
      const run = (productRun.current += 1);
      setProducts([]);
      setProductsError(null);
      setProductsLoading(true);

      void (async () => {
        try {
          const list = await listProducts({
            serviceProviderId: provider.id,
            country: provider.country ?? "NG",
          });
          if (productRun.current !== run) return;
          setProducts(list);
          if (list.length === 0 && !category.freeAmount) {
            setProductsError(`${provider.name} has no plans listed right now.`);
          }
        } catch (e) {
          if (productRun.current !== run) return;
          const message = describe(e);
          // A biller whose catalogue 404s is not a broken screen — it is a
          // biller with nothing to sell today, and the free-amount shelves can
          // still be paid without a product at all.
          setProductsError(
            message ?? (category.freeAmount ? null : "Could not load plans."),
          );
        } finally {
          if (productRun.current === run) setProductsLoading(false);
        }
      })();
    },
    [describe],
  );

  /* -------------------------------------------------------------- purchase */

  const intentOf = (d: BillDraft): PurchaseIntent => ({
    serviceType: d.category.serviceType,
    serviceCategory: d.category.category,
    serviceProviderId: d.provider.id,
    destinationIdentifier: d.destinationWire,
    amount: d.amount,
    serviceProductCode: d.product?.code ?? null,
  });

  const confirm = useCallback(async () => {
    if (!draft || inFlightRef.current) return;
    inFlightRef.current = true;
    setCheckoutError(null);
    setPhase("placing");

    const intent = intentOf(draft);
    const slot = purchaseSlot(intent);
    slotRef.current = slot;

    try {
      // Same intent, same slot, same key — every time, including after a
      // relaunch. This is the call that must never be inside a catch block.
      const key = await reserveIdempotencyKey(slot, "vas");
      const placed = await purchase(intent, { idempotencyKey: key });
      setTransaction(placed);

      if (isTerminalTransfer(placed.status)) {
        setPhase("settled");
        await releaseIdempotencyKey(slot);
      } else {
        setPhase("watching");
      }
    } catch (e) {
      // The key stays reserved. Whatever this was — a timeout, a 502, a dropped
      // connection — the purchase may well have landed, and the only safe next
      // move is to send the identical request again.
      const message = describe(e);
      setPhase("confirm");
      if (message) setCheckoutError(message);
    } finally {
      inFlightRef.current = false;
    }
  }, [draft, describe]);

  /* --------------------------------------------------------------- polling */

  const [watchToken, setWatchToken] = useState(0);
  const transactionId = transaction?.id ?? null;

  useEffect(() => {
    if (phase !== "watching" || !transactionId) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const final = await pollTransaction(transactionId, {
          signal: controller.signal,
          currency: draft?.amount.currency,
          onUpdate: (snapshot) => {
            if (controller.signal.aborted) return;
            setTransaction(snapshot);
          },
        });
        if (controller.signal.aborted) return;
        if (isTerminalTransfer(final.status)) {
          setPhase("settled");
          const slot = slotRef.current;
          // Terminal in either direction closes the operation: a FAILED
          // purchase will not change its mind, so the key has done its job.
          if (slot) await releaseIdempotencyKey(slot);
        }
        // Not terminal means the poll ran out its clock. The screen keeps
        // saying "in progress", which is the truth.
      } catch (e) {
        if (AbortedError.is(e) || controller.signal.aborted) return;
        const message = describe(e);
        if (message) setCheckoutError(message);
      }
    })();

    return () => controller.abort();
  }, [phase, transactionId, watchToken, draft?.amount.currency, describe]);

  /* ----------------------------------------------------------- navigation */

  const leaveCheckout = useCallback(() => {
    setDraft(null);
    setTransaction(null);
    setCheckoutError(null);
    setPhase("confirm");
    slotRef.current = null;
  }, []);

  /**
   * Checkout is another lane's and has no route yet, so `SUBSCRIPTION_ROUTE`
   * from `@/lib/routes` points at a file that does not exist. Say it out loud
   * rather than pushing at nothing — the screen already explains the state
   * behind this, and this matches what `src/app/fiat.tsx` does for the same
   * gap.
   *
   * When `src/app/subscribe.tsx` lands, this whole body becomes
   * `router.push(SUBSCRIPTION_ROUTE)`.
   */
  const needsSubscription = useCallback(() => {
    toast.info("Subscription required", "Bills need an active Paradigm plan.");
  }, [toast]);

  const retryCheckout = useCallback(() => {
    setCheckoutError(null);
    // With a transaction in hand the failure was the watch, not the purchase.
    if (transactionId) setWatchToken((n) => n + 1);
    else void confirm();
  }, [transactionId, confirm]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      {draft ? (
        <BillCheckoutScreen
          top={headerHeight}
          draft={draft}
          phase={phase}
          transaction={transaction}
          error={checkoutError}
          onConfirm={() => void confirm()}
          onBack={leaveCheckout}
          onRetry={retryCheckout}
          onDone={() => {
            leaveCheckout();
            router.back();
          }}
          onStartOver={leaveCheckout}
        />
      ) : (
        <BillsScreen
          top={headerHeight}
          loading={loading}
          categories={categories}
          error={error}
          onRetry={retryCatalog}
          block={block}
          onNeedsSubscription={needsSubscription}
          products={products}
          productsLoading={productsLoading}
          productsError={productsError}
          onProviderSelected={onProviderSelected}
          onSubmit={setDraft}
        />
      )}
      {/* Back steps out of the checkout before it steps out of the route, so
          the receipt is never skipped past by muscle memory. It is inert while
          a purchase is actually on the wire. */}
      <NavHeader
        wordmark="BILLS"
        tagline="POWERED BY LINKPAY"
        direction="column"
        onBack={() => {
          if (phase === "placing") return;
          if (draft) leaveCheckout();
          else router.back();
        }}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
