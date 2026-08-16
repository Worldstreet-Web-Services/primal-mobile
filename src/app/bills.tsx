import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
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
import { SIGN_IN_ROUTE, SUBSCRIPTION_ROUTE } from "@/lib/routes";
import {
  beginSeparatePurchase,
  closePurchaseAttempt,
  discoverCatalog,
  listProducts,
  notePurchaseAccepted,
  planPurchase,
  pollTransaction,
  purchase,
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
 * perfectly well and has not paid, and goes to the subscription screen.
 *
 * **One key per purchase ATTEMPT.** `planPurchase` decides, before anything is
 * sent, whether this tap is a retry of a purchase already in the air (resume it,
 * send nothing), a new purchase of something bought before (a slot and a key of
 * its own), or a re-send of one the gateway never named (the same key again).
 * A timeout is never treated as a failure: the retry path re-sends, it does not
 * re-mint, and nothing releases a key because a screen was closed.
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

/**
 * The draft, as the gateway needs to hear it. Module scope on purpose: it is a
 * pure function of the draft, and the purchase path must never close over a
 * render's copy of anything.
 */
const intentOf = (d: BillDraft): PurchaseIntent => ({
  serviceType: d.category.serviceType,
  serviceCategory: d.category.category,
  serviceProviderId: d.provider.id,
  destinationIdentifier: d.destinationWire,
  amount: d.amount,
  serviceProductCode: d.product?.code ?? null,
});

export default function Bills() {
  const { primal, status, linkPrimal, refreshEntitlement } = useAuth();
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
  /**
   * Whether the failure being shown happened after the purchase left the
   * client. It decides what "try again" honestly means, and the two answers are
   * not interchangeable: a throw from `planPurchase` is a read that failed with
   * nothing sent, and telling that person their retry "re-sends the same
   * purchase" describes a request that was never made.
   */
  const [sentBeforeError, setSentBeforeError] = useState(false);
  /**
   * Set when this checkout is following a purchase that was placed earlier
   * rather than one placed by the tap that opened it — the difference between
   * "here is your receipt" and "here is the receipt you already had".
   */
  const [resumedAt, setResumedAt] = useState<number | null>(null);

  /** The slot whose key is currently spent-or-spending. Closed on terminal. */
  const slotRef = useRef<string | null>(null);
  /**
   * Bumped whenever this checkout stops following what it was following. A poll
   * request already on the wire outlives the state change that abandoned it by
   * one round trip, and without a generation to check against it lands on
   * whatever the screen is showing now — putting an abandoned purchase's status,
   * figures and token back on a screen that has moved on.
   */
  const watchRun = useRef(0);
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
      // A sentence as well as the routing: `block` is only rendered by the
      // browse screen, and a 403 raised mid-checkout would otherwise put the
      // user back on an unchanged Confirm with nothing said at all.
      return "Bills need an active Paradigm plan. Your sign-in is fine — only the plan has lapsed.";
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

  const confirm = useCallback(async () => {
    if (!draft || inFlightRef.current) return;
    inFlightRef.current = true;
    setCheckoutError(null);
    // Whatever the last attempt was refused for, this one is judged on its own.
    setBlock(null);
    // Not "placing": nothing is on the wire yet. This phase covers the question
    // `planPurchase` asks about the LAST attempt, which is a read — and a
    // spinner that says a purchase is being placed over a lookup is a claim
    // about money that is not moving.
    setPhase("checking");

    const intent = intentOf(draft);
    // Read in the catch, so the screen can say which kind of failure this was.
    let sent = false;

    try {
      // What this tap MEANS is a question about the last attempt at this exact
      // purchase, and only the gateway can answer it. Asking first is what
      // stops a second ₦500 top-up of the same line being answered with the
      // first one's transaction — and what stops a retry becoming a second
      // purchase. Nothing is sent until this returns.
      const plan = await planPurchase(intent);
      slotRef.current = plan.slot;

      if (plan.action === "resume") {
        // Already in the air. Follow it; place nothing.
        setTransaction(plan.transaction);
        setResumedAt(plan.startedAt);
        setPhase("watching");
        return;
      }

      setResumedAt(null);
      setPhase("placing");
      sent = true;
      const placed = await purchase(intent, { idempotencyKey: plan.idempotencyKey });
      setTransaction(placed);
      // The id goes into the record before anything else happens to it: it is
      // the only thing that can resolve this attempt if the app dies now.
      await notePurchaseAccepted(plan.slot, placed.id);

      if (isTerminalTransfer(placed.status)) {
        setPhase("settled");
        await closePurchaseAttempt(plan.slot);
      } else if (placed.id) {
        setPhase("watching");
      } else {
        // Accepted, and unfollowable: the gateway named nothing to poll. Going
        // to "watching" would be a claim about a watch that cannot run.
        setPhase("stalled");
      }
    } catch (e) {
      // The key stays reserved. Whatever this was — a timeout, a 502, a dropped
      // connection — the purchase may well have landed, and the only safe next
      // move is to send the identical request again.
      const message = describe(e);
      setPhase("confirm");
      setSentBeforeError(sent);
      if (message) setCheckoutError(message);
    } finally {
      inFlightRef.current = false;
    }
  }, [draft, describe]);

  /**
   * "Buy it anyway" over an earlier purchase that will not finish.
   *
   * `planPurchase` only advances the attempt on a terminal status, which is
   * exactly right for a retry and leaves one hole: a purchase that never
   * reaches one — genuinely stuck, or wearing a status this build does not
   * recognise — would make that phone number and amount unbuyable for good,
   * because every later tap on Pay resumes the same unfinished transaction.
   *
   * This is the deliberate second purchase, and it is deliberately two taps:
   * the record moves on here, and the person still has to confirm the payment
   * itself on the screen it returns them to.
   */
  const buyAnyway = useCallback(() => {
    const slot = slotRef.current;
    if (!slot || inFlightRef.current) return;
    inFlightRef.current = true;
    // Nothing that is still following the old purchase may write to this screen
    // again — its answer would land on the purchase being composed instead.
    watchRun.current += 1;
    void (async () => {
      try {
        await beginSeparatePurchase(slot);
        // Only after the record has moved on, so a Pay in the gap cannot be
        // answered by the very attempt this is stepping away from.
        slotRef.current = null;
        setTransaction(null);
        setResumedAt(null);
        setCheckoutError(null);
        setSentBeforeError(false);
        setPhase("confirm");
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, []);

  /* --------------------------------------------------------------- polling */

  const [watchToken, setWatchToken] = useState(0);
  const transactionId = transaction?.id ?? null;

  useEffect(() => {
    if (phase !== "watching" || !transactionId) return;
    const controller = new AbortController();
    const run = (watchRun.current += 1);
    /** Still the watch this screen is on. Abort covers unmount; the generation
     *  covers the gap between abandoning a purchase and the effect tearing
     *  down, which is exactly one in-flight request wide. */
    const live = () => !controller.signal.aborted && watchRun.current === run;

    void (async () => {
      try {
        const final = await pollTransaction(transactionId, {
          signal: controller.signal,
          currency: draft?.amount.currency,
          onUpdate: (snapshot) => {
            if (!live()) return;
            setTransaction(snapshot);
          },
        });
        if (!live()) return;
        if (isTerminalTransfer(final.status)) {
          setPhase("settled");
          const slot = slotRef.current;
          // Terminal in either direction closes the operation: a FAILED
          // purchase will not change its mind, so the attempt is closed and its
          // key released.
          if (slot) await closePurchaseAttempt(slot);
          return;
        }
        // Not terminal means the poll ran out its clock. The purchase is still
        // with the provider, but nothing here is following it any more — and a
        // screen that keeps pulsing over someone's money while nobody is
        // watching is a lie. Say so, and offer to pick it back up.
        setPhase("stalled");
      } catch (e) {
        if (AbortedError.is(e) || !live()) return;
        // The watch gave up — five straight network misses, a 404 that never
        // resolved, a 403. Whatever it was, this loop is finished, so the phase
        // has to stop claiming otherwise: leaving it on "watching" pulses a live
        // dot and tells the person they can walk away because it is being
        // followed, over a purchase nothing is following. Stalled says the true
        // thing and carries the button that picks the watch back up.
        setPhase("stalled");
        const message = describe(e);
        if (message) setCheckoutError(message);
      }
    })();

    return () => controller.abort();
  }, [phase, transactionId, watchToken, draft?.amount.currency, describe]);

  /* ----------------------------------------------------------- navigation */

  /**
   * Take down a paywall that came off the wire rather than from the gate.
   *
   * A 403 mid-flight says the plan has lapsed, and it has to be said — but as a
   * panel over a working screen it is a claim with no way forward: the browse
   * screen answers `block` with a card that has no route back to the biller
   * list, and the gate effect will not re-run to rescue it because
   * `primal.state` has not changed. So the leftover goes and the entitlement
   * gate is asked for the truth instead.
   *
   * The gate's own verdict is never dismissible. When IT says subscription,
   * there is no catalogue behind the card to go back to and the paywall is the
   * whole screen on purpose.
   */
  const dismissWirePaywall = useCallback(() => {
    if (gate === "subscription") return;
    setBlock(null);
    void refreshEntitlement();
  }, [gate, refreshEntitlement]);

  /**
   * Step out of the checkout without touching the purchase.
   *
   * Nothing is released here, on purpose. Leaving is not an outcome — the
   * purchase carries on at the provider — and the record `planPurchase` wrote
   * is what picks it back up next time this intent is paid for, either resuming
   * it or retiring it. Releasing the key on the way out is precisely what would
   * let the next tap mint a second one and buy the same thing twice.
   *
   * The one thing that does not follow the user out is a refusal that was about
   * the account rather than about this purchase.
   */
  const leaveCheckout = useCallback(() => {
    watchRun.current += 1;
    setDraft(null);
    setTransaction(null);
    setCheckoutError(null);
    setSentBeforeError(false);
    setResumedAt(null);
    setPhase("confirm");
    slotRef.current = null;
    // The 403 that refused this purchase has already been said on the checkout
    // screen. Carrying it back to the browse screen turns the way out into a
    // dead end, so it goes here rather than following the user.
    if (block === "subscription") dismissWirePaywall();
  }, [block, dismissWirePaywall]);

  /**
   * The gateway refused on entitlement. The contract's rule is "403
   * ACTIVE_SUBSCRIPTION_REQUIRED -> subscription screen", so this goes to the
   * paywall rather than narrating the refusal and leaving the member nowhere.
   */
  const needsSubscription = useCallback(() => {
    router.push(SUBSCRIPTION_ROUTE);
  }, []);

  const retryCheckout = useCallback(() => {
    setCheckoutError(null);
    // The paywall panel is a claim about a refusal that is about to be tested
    // again. Leaving it up over a watch that is working says the plan has
    // lapsed while the gateway is answering perfectly — and if the refusal is
    // still real, the next 403 puts it straight back. The gate's own verdict is
    // not a leftover, so it is not cleared here.
    if (gate !== "subscription") setBlock(null);
    // With a transaction in hand the failure was the watch, not the purchase —
    // so this picks the watch back up rather than sending anything.
    if (transactionId) {
      setPhase("watching");
      setWatchToken((n) => n + 1);
      return;
    }
    void confirm();
  }, [gate, transactionId, confirm]);

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      {draft ? (
        <BillCheckoutScreen
          top={headerHeight}
          draft={draft}
          phase={phase}
          transaction={transaction}
          error={checkoutError}
          sent={sentBeforeError}
          blocked={block === "subscription"}
          resumedAt={resumedAt}
          onNeedsSubscription={needsSubscription}
          onConfirm={() => void confirm()}
          onBack={leaveCheckout}
          onRetry={retryCheckout}
          onBuyAnyway={buyAnyway}
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
          // Only offered when there is genuinely a biller list behind the card
          // and the refusal came off the wire — a lapse the gate itself has
          // ruled on is not something a button can dismiss.
          onDismissBlock={
            block === "subscription" && gate !== "subscription" && categories.length > 0
              ? dismissWirePaywall
              : undefined
          }
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
          a purchase is on the wire, and while the client is still working out
          whether this tap is a retry or a new purchase — abandoning that
          half-way leaves the answer to arrive against a screen that has gone. */}
      <NavHeader
        wordmark="BILLS"
        tagline="POWERED BY LINKPAY"
        direction="column"
        onBack={() => {
          if (phase === "placing" || phase === "checking") return;
          if (draft) leaveCheckout();
          else router.back();
        }}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
