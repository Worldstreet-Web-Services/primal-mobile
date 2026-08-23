import React, { useMemo, useState } from "react";
import { TextInput, View } from "react-native";

import {
  Body,
  Card,
  Chip,
  Display,
  GhostButton,
  Label,
  MetallicButton,
  Mono,
  PressableScale,
  Pulse,
  Screen,
  SectionRule,
} from "../components/ui";
import {
  destinationSpec,
  networkMismatch,
  normalizeDestination,
  validateDestination,
  wireDestination,
  type VasCategory,
  type VasProduct,
  type VasProvider,
} from "../lib/gateway/services";
import { formatMoney, MoneyError, parseMoney, type Money } from "../lib/gateway";
import { C, F } from "../theme/tokens";

/**
 * Everything the checkout needs to state what is about to happen, resolved
 * once here so no later screen has to re-derive an amount or re-normalise a
 * phone number. `destinationWire` is what goes to the gateway;
 * `destinationDisplay` is what the person typed, and the two are kept apart on
 * purpose — showing someone `2348031234567` when they typed `08031234567`
 * makes them doubt a number that is in fact correct.
 */
export interface BillDraft {
  category: VasCategory;
  provider: VasProvider;
  /** Null when the user named their own amount. */
  product: VasProduct | null;
  amount: Money;
  destinationDisplay: string;
  destinationWire: string;
}

/** Why the surface is closed, when it is. */
export type BillsBlock = "subscription" | null;

const CUSTOM = "__custom__";

/** One shelf in the grid. */
function CategoryTile({
  category,
  onPress,
}: {
  category: VasCategory;
  onPress: () => void;
}) {
  const count = category.providers.length;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={category.label}
      style={{ width: "48%" }}
    >
      <Card style={{ padding: 14, minHeight: 104, justifyContent: "space-between" }}>
        <View>
          <Display size={17}>{category.label}</Display>
          <Body size={11.5} color={C.dim} numberOfLines={2} style={{ marginTop: 5 }}>
            {category.blurb}
          </Body>
        </View>
        <Mono size={10} color={C.dim} style={{ letterSpacing: 1.2, marginTop: 10 }}>
          {count} {count === 1 ? "BILLER" : "BILLERS"}
        </Mono>
      </Card>
    </PressableScale>
  );
}

/** A plan, bundle or denomination. */
function ProductRow({
  product,
  active,
  onPress,
  currency,
}: {
  product: VasProduct;
  active: boolean;
  onPress: () => void;
  currency: string;
}) {
  const meta = [product.dataSize, product.validity].filter(Boolean).join(" · ");
  return (
    <PressableScale onPress={onPress} accessibilityLabel={product.name}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 13,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: active ? C.brandSoft : C.hairline,
          backgroundColor: active ? C.brandGlow : C.card,
        }}
      >
        <View style={{ flex: 1 }}>
          <Body size={13.5} semibold numberOfLines={1}>
            {product.name}
          </Body>
          {meta ? (
            <Body size={11} color={C.dim} style={{ marginTop: 3 }}>
              {meta}
            </Body>
          ) : null}
        </View>
        <Mono size={13} color={active ? C.brandSoft : C.silver}>
          {product.amount ? formatMoney(product.amount) : "Any amount"}
        </Mono>
      </View>
    </PressableScale>
  );
}

/**
 * Bills — the value-added services surface.
 *
 * Presentational. The catalogue, the products and the outcome all arrive as
 * props; the only things this screen owns are the selections and the two text
 * fields, because those are questions about the person in front of it rather
 * than about the gateway.
 *
 * The shelf list is never hardcoded: whatever `categories` contains is what
 * exists, and an empty array is a sentence this screen can say out loud.
 */
export default function BillsScreen({
  top = 0,
  loading,
  categories,
  error,
  onRetry,
  block = null,
  onDismissBlock,
  onNeedsSubscription,
  products,
  productsLoading,
  productsError,
  onProviderSelected,
  onSubmit,
  currency = "NGN",
}: {
  top?: number;
  /** First sweep in flight and nothing has landed yet. */
  loading: boolean;
  categories: VasCategory[];
  error: string | null;
  onRetry?: () => void;
  block?: BillsBlock;
  /**
   * Step back to the biller list. Passed only when this refusal arrived on a
   * single response while the catalogue was already up — a card that replaces
   * the whole screen and offers nothing but "See plans" is a dead end, and the
   * route knows the difference between that and an account the entitlement gate
   * itself has ruled on.
   */
  onDismissBlock?: () => void;
  onNeedsSubscription?: () => void;
  products: VasProduct[];
  productsLoading: boolean;
  productsError: string | null;
  /** Fired when the provider changes — the route fetches that provider's plans. */
  onProviderSelected: (category: VasCategory, provider: VasProvider) => void;
  onSubmit: (draft: BillDraft) => void;
  currency?: string;
}) {
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [productCode, setProductCode] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [destination, setDestination] = useState("");

  const category = useMemo(
    () => categories.find((c) => c.key === categoryKey) ?? null,
    [categories, categoryKey],
  );
  const provider = useMemo(
    () => category?.providers.find((p) => p.id === providerId) ?? null,
    [category, providerId],
  );
  const product = useMemo(
    () => (productCode && productCode !== CUSTOM
      ? products.find((p) => p.code === productCode) ?? null
      : null),
    [products, productCode],
  );

  const spec = destinationSpec(category?.destination ?? "account");

  /* ------------------------------------------------------------ selection */

  const pickCategory = (next: VasCategory) => {
    setCategoryKey(next.key);
    setProviderId(null);
    setProductCode(null);
    setAmountText("");
    setDestination("");
    // A shelf with one biller has no choice to offer — make it for them.
    if (next.providers.length === 1) {
      setProviderId(next.providers[0].id);
      onProviderSelected(next, next.providers[0]);
    }
  };

  const pickProvider = (next: VasProvider) => {
    if (!category) return;
    setProviderId(next.id);
    setProductCode(null);
    onProviderSelected(category, next);
  };

  const backToShelves = () => {
    setCategoryKey(null);
    setProviderId(null);
    setProductCode(null);
    setAmountText("");
    setDestination("");
  };

  /* ------------------------------------------------------------ the amount */

  // The amount field appears when the person has actually asked for it — by
  // choosing "my own amount", by there being no plans to choose from, or by
  // choosing a plan the feed quoted no price for. Showing it alongside an
  // unmade choice reads as two competing questions.
  const customAllowed = !!category?.freeAmount;
  const usingCustom =
    (customAllowed && (productCode === CUSTOM || products.length === 0)) ||
    (!!product && !product.amount);

  let amount: Money | null = null;
  let amountError: string | null = null;
  if (usingCustom) {
    const typed = amountText.trim();
    if (typed !== "") {
      try {
        const parsed = parseMoney(typed, currency, { precision: "truncate" });
        amount = BigInt(parsed.amountMinor) > 0n ? parsed : null;
        if (!amount) amountError = "Enter an amount above zero.";
      } catch (e) {
        amountError = e instanceof MoneyError ? e.message : "That is not an amount.";
      }
    }
  } else if (product?.amount) {
    amount = product.amount;
  }

  const country = provider?.country ?? "NG";

  const destinationError = category
    ? validateDestination(category.destination, destination, country)
    : null;
  const destinationReady = destination.trim() !== "" && !destinationError;

  const mismatch =
    provider && category?.destination === "phone" && destinationReady
      ? networkMismatch(provider.name, destination, country)
      : null;

  const ready = !!category && !!provider && !!amount && destinationReady;

  const submit = () => {
    if (!category || !provider || !amount || !ready) return;
    onSubmit({
      category,
      provider,
      // `product`, not `usingCustom ? null : product`. The two questions look
      // alike and are not: "who names the amount" is not "what is being
      // bought". A bouquet the feed quoted no price for made the first answer
      // "the person" and the old ternary let that erase the second, sending
      // ₦10,500 to a TV biller with no plan attached and a confirm screen that
      // never named what was being bought. The memo above already yields null
      // for the custom tile, for no selection and for an empty plan list, which
      // are the only cases where there is genuinely no product.
      product,
      amount,
      destinationDisplay: normalizeDestination(category.destination, destination),
      destinationWire: wireDestination(category.destination, destination, country),
    });
  };

  /* ------------------------------------------------------------- blocked */

  if (block === "subscription") {
    return (
      <Screen top={top} center>
        <Card style={{ width: "100%", padding: 20, alignItems: "center" }}>
          <Label>KashPlus</Label>
          <Display size={22} style={{ marginTop: 10, textAlign: "center" }}>
            Bills need an active plan
          </Display>
          <Body
            size={13}
            color={C.sub}
            style={{ marginTop: 10, textAlign: "center", lineHeight: 19 }}
          >
            Airtime, data, power and TV run on your KashPlus subscription. Your
            sign-in is fine — only the plan has lapsed.
          </Body>
          <View style={{ height: 18 }} />
          <MetallicButton
            label="See plans"
            onPress={onNeedsSubscription}
            height={48}
          />
          {onDismissBlock ? (
            <>
              <View style={{ height: 10 }} />
              <GhostButton
                label="Back to billers"
                onPress={onDismissBlock}
                height={44}
                style={{ paddingHorizontal: 22 }}
              />
            </>
          ) : null}
        </Card>
      </Screen>
    );
  }

  /* -------------------------------------------------------------- browse */

  if (!category) {
    return (
      <Screen top={top}>
        <View style={{ marginTop: 22 }}>
          <Display size={30}>Bills</Display>
          <Body size={13} color={C.sub} style={{ marginTop: 7, lineHeight: 19 }}>
            Airtime, data, power, TV — paid from your naira balance.
          </Body>
        </View>

        <SectionRule space={20} />

        {loading && categories.length === 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 12,
            }}
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Pulse key={i} width="48%" height={104} radius={20} />
            ))}
          </View>
        ) : null}

        {!loading && error ? (
          <Card style={{ padding: 18 }}>
            <Body size={13.5} semibold>
              Could not load the biller list
            </Body>
            <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
              {error}
            </Body>
            <View style={{ height: 14 }} />
            <GhostButton label="Try again" onPress={onRetry} />
          </Card>
        ) : null}

        {!loading && !error && categories.length === 0 ? (
          <Card style={{ padding: 18 }}>
            <Body size={13.5} semibold>
              Nothing to pay here yet
            </Body>
            <Body size={12.5} color={C.sub} style={{ marginTop: 6, lineHeight: 18 }}>
              This account has no billers enabled. Nothing is broken — there is
              simply no catalogue on it today.
            </Body>
            <View style={{ height: 14 }} />
            <GhostButton label="Check again" onPress={onRetry} />
          </Card>
        ) : null}

        {categories.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 12,
            }}
          >
            {categories.map((c) => (
              <CategoryTile key={c.key} category={c} onPress={() => pickCategory(c)} />
            ))}
          </View>
        ) : null}

        {loading && categories.length > 0 ? (
          <Body size={11.5} color={C.dim} style={{ marginTop: 16 }}>
            Still checking for more billers…
          </Body>
        ) : null}
      </Screen>
    );
  }

  /* ------------------------------------------------------------- compose */

  return (
    // Two fields on number-pad and decimal-pad keyboards, neither of which has
    // a dismiss key on iOS, and every control the person needs next — the
    // biller chips, the plan rows, Review — sits under them. Without
    // "handled" the first tap on any of those is eaten dismissing the
    // keyboard, which on a payment form reads as a button that does not work.
    <Screen top={top} bottom={56} keyboardShouldPersistTaps="handled">
      <View style={{ marginTop: 22, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Label>{category.serviceType.toUpperCase()}</Label>
          <Display size={26} style={{ marginTop: 6 }}>
            {category.label}
          </Display>
        </View>
        <GhostButton
          label="Change"
          onPress={backToShelves}
          height={38}
          size={12}
          style={{ paddingHorizontal: 16 }}
        />
      </View>

      <SectionRule space={18} />

      <Label>Biller</Label>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {category.providers.map((p) => (
          <Chip
            key={p.id}
            label={p.shortName ?? p.name}
            active={p.id === provider?.id}
            tone="brand"
            onPress={() => pickProvider(p)}
          />
        ))}
      </View>

      {provider ? (
        <>
          <SectionRule space={18} />

          <Label>{spec.label}</Label>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder={spec.placeholder}
            placeholderTextColor={C.dim}
            keyboardType={spec.numeric ? "number-pad" : "default"}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={spec.maxLength + 4}
            style={{
              height: 54,
              marginTop: 10,
              borderRadius: 14,
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: destinationError ? C.down : C.border,
              paddingHorizontal: 16,
              color: C.text,
              fontFamily: F.mono,
              fontSize: 16,
              letterSpacing: 1,
            }}
          />
          <Body
            size={11.5}
            color={destinationError ? C.down : C.dim}
            style={{ marginTop: 8, lineHeight: 17 }}
          >
            {destinationError ?? spec.help}
          </Body>
          {mismatch ? (
            <Body size={11.5} color={C.amber} style={{ marginTop: 6, lineHeight: 17 }}>
              That number looks like {mismatch}. Ported lines are common, so
              this may still be right — check before you pay.
            </Body>
          ) : null}
          {provider.requiresValidation === false ? (
            <Body size={11.5} color={C.dim} style={{ marginTop: 6, lineHeight: 17 }}>
              {provider.name} cannot confirm this number before payment.
            </Body>
          ) : null}

          <SectionRule space={18} />

          <Label>{customAllowed ? "Amount or plan" : "Plan"}</Label>

          {productsLoading ? (
            <View style={{ marginTop: 10, gap: 10 }}>
              <Pulse height={52} radius={14} />
              <Pulse height={52} radius={14} />
              <Pulse height={52} radius={14} />
            </View>
          ) : null}

          {!productsLoading && productsError ? (
            <Card style={{ padding: 16, marginTop: 10 }}>
              <Body size={12.5} color={C.sub} style={{ lineHeight: 18 }}>
                {productsError}
              </Body>
            </Card>
          ) : null}

          {!productsLoading && !productsError && products.length === 0 && !customAllowed ? (
            <Card style={{ padding: 16, marginTop: 10 }}>
              <Body size={12.5} color={C.sub} style={{ lineHeight: 18 }}>
                {provider.name} has no plans listed right now. Try another
                biller, or come back shortly.
              </Body>
            </Card>
          ) : null}

          {!productsLoading && products.length > 0 ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              {products.map((p) => (
                <ProductRow
                  key={p.code}
                  product={p}
                  currency={currency}
                  active={productCode === p.code}
                  onPress={() => {
                    setProductCode(p.code);
                    if (p.amount) setAmountText("");
                  }}
                />
              ))}
              {customAllowed ? (
                <PressableScale
                  onPress={() => setProductCode(CUSTOM)}
                  accessibilityLabel="Enter my own amount"
                >
                  <View
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderStyle: "dashed",
                      borderColor: productCode === CUSTOM ? C.brandSoft : C.border,
                      backgroundColor: productCode === CUSTOM ? C.brandGlow : "transparent",
                    }}
                  >
                    <Body size={13} semibold color={productCode === CUSTOM ? C.brandSoft : C.silver}>
                      Enter my own amount
                    </Body>
                  </View>
                </PressableScale>
              ) : null}
            </View>
          ) : null}

          {usingCustom ? (
            <>
              <TextInput
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0.00"
                placeholderTextColor={C.dim}
                keyboardType="decimal-pad"
                style={{
                  height: 62,
                  marginTop: 12,
                  borderRadius: 14,
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: amountError ? C.down : C.border,
                  paddingHorizontal: 16,
                  color: C.text,
                  fontFamily: F.display,
                  fontSize: 26,
                }}
              />
              <Body
                size={11.5}
                color={amountError ? C.down : C.dim}
                style={{ marginTop: 8 }}
              >
                {amountError ?? `In ${currency}. Whole naira is fine.`}
              </Body>
            </>
          ) : null}

          <View style={{ height: 26 }} />

          <MetallicButton
            label={amount ? `Review ${formatMoney(amount)}` : "Review"}
            onPress={submit}
            disabled={!ready}
          />
          {/* A disabled CTA that says nothing makes people tap it twice and
              conclude the app is broken. Name the missing piece instead. */}
          <Body size={11} color={C.dim} style={{ marginTop: 12, textAlign: "center" }}>
            {!destinationReady
              ? `Enter the ${spec.label.toLowerCase()} to continue.`
              : !amount
                ? customAllowed
                  ? "Choose a plan, or enter your own amount."
                  : "Choose a plan to continue."
                : "Nothing is taken until you confirm on the next screen."}
          </Body>
        </>
      ) : (
        <Body size={12.5} color={C.dim} style={{ marginTop: 18, lineHeight: 18 }}>
          Pick a biller to see what it sells.
        </Body>
      )}
    </Screen>
  );
}
