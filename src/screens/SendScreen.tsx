import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  Body,
  BackChevron,
  Display,
  GhostButton,
  Keypad,
  Label,
  MetallicButton,
  Mono,
  PressableScale,
  Pulse,
  Screen,
  SectionRule,
  Shine,
} from "../components/ui";
import { setPayoutDraft } from "../hooks/useLinkpay";
import {
  describeLinkpayFailure,
  getBalance,
  listBanks,
  maskAccount,
  validateBankAccount,
} from "../lib/gateway/linkpay";
import { compareMoney, formatMoney, parseMoney } from "../lib/gateway/money";
import {
  AbortedError,
  SessionExpiredError,
  isEntitlementError,
  type Balance,
  type Bank,
  type Money,
} from "../lib/gateway/types";
import { C, F } from "../theme/tokens";

/**
 * Design 4d, rewired: a naira payout to a Nigerian bank account.
 *
 * The mock build offered a second rail — @tag payments between Paradigm
 * accounts. There is no route on the gateway that moves money that way, so the
 * tab is gone rather than sitting there as a button that cannot work.
 *
 * The order of the steps is the safety property. The bank comes first because
 * the name enquiry is keyed on it; the number second; and the resolved NAME is
 * a step of its own that the user has to accept, because it is the only proof
 * the money is going where they meant. Nothing is resolved-and-sent in one
 * motion, and no amount is entered before the recipient is settled.
 */

type Step = "bank" | "account" | "review" | "amount";

const COUNTRY = "NG";
const CURRENCY = "NGN";
/** NUBAN is fixed-length; anything else is a typo, not a short account. */
const NUBAN_LENGTH = 10;
/** ₦99,999,999 — past any sane single payout, and it keeps the figure legible. */
const MAX_DIGITS = 8;
/** A long bank list in a ScrollView is a dropped frame; the search is the tool. */
const MAX_BANK_ROWS = 40;

const fmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** `0123456789` → `0123 456 789`, the way a NUBAN is read aloud. */
function groupNuban(digits: string): string {
  const a = digits.slice(0, 4);
  const b = digits.slice(4, 7);
  const c = digits.slice(7, 10);
  return [a, b, c].filter(Boolean).join(" ");
}

/**
 * `amount > balance`, and `false` for anything it cannot read.
 *
 * `compareMoney` throws on a wire value that is not an integer minor-unit
 * string, and this is evaluated in the render body of the last step before a
 * payout — a gateway that serialises a Decimal as `"12500.00"` would take the
 * whole flow down with an uncaught exception. Declining to compare is the
 * lesser harm: the warning goes quiet, the gateway still refuses an overdrawn
 * payout on its own, and the screen already treats a missing balance that way.
 * The twin of `exceeds` in SendConfirmScreen, for the same reason.
 */
function overBalance(amount: Money | null, balance: Money | null): boolean {
  if (!amount || !balance) return false;
  if (balance.currency.toUpperCase() !== CURRENCY) return false;
  try {
    return compareMoney(amount, balance) > 0;
  } catch {
    return false;
  }
}

function monogram(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, "").trim().split(/\s+/);
  if (words.length === 0 || words[0] === "") return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function Check({ size = 13, color = C.brandSoft }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function Forward({ color = C.dim }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path
        d="M9.5 5 16 12l-6.5 7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Header with a tracked subline — the register's provenance, one line, dim. */
function Head({ title, sub, onBack }: { title: string; sub: string; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10 }}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
        <BackChevron />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Display size={20}>{title}</Display>
        <Mono size={9.5} color={C.dim} style={{ marginTop: 3, letterSpacing: 1.4 }}>
          {sub}
        </Mono>
      </View>
    </View>
  );
}

/** The raised surface everything on this screen sits on: hairline, machined top edge. */
function Panel({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: React.ComponentProps<typeof View>["style"];
  /** Brand hairline — reserved for the one verified thing on the view. */
  accent?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: accent ? "rgba(131,190,96,0.32)" : C.hairline,
          borderRadius: 20,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Shine />
      {children}
    </View>
  );
}

function Tile({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: accent ? 21 : 14,
        backgroundColor: accent ? C.brandGlow : C.inset,
        borderWidth: 1,
        borderColor: accent ? "rgba(131,190,96,0.28)" : C.hairline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 12.5,
          letterSpacing: 0.8,
          color: accent ? C.brandSoft : C.silver,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export default function SendScreen({
  onBack,
  onContinue,
  onNeedsSubscription,
}: {
  onBack?: () => void;
  /** The draft is set before this fires — the confirm route reads it. */
  onContinue?: () => void;
  onNeedsSubscription?: () => void;
}) {
  const [step, setStep] = useState<Step>("bank");

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [bank, setBank] = useState<Bank | null>(null);

  const [nuban, setNuban] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [resolvedAt, setResolvedAt] = useState<number | null>(null);

  const [balance, setBalance] = useState<Balance | null>(null);
  const [digits, setDigits] = useState("");

  // The one motion moment: the figure settles onto its new value instead of
  // snapping to it. Entry, backspace and the first render all use the same
  // spring, so the panel reads like a mechanism rather than a text field.
  const settle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    settle.setValue(0);
    Animated.spring(settle, {
      toValue: 1,
      useNativeDriver: true,
      speed: 26,
      bounciness: 5,
    }).start();
  }, [digits, settle]);
  const lift = settle.interpolate({ inputRange: [0, 1], outputRange: [5, 0] });

  // The route hands this in as an inline arrow, so it is a new function every
  // render. Held in a ref rather than a dependency: a callback identity must
  // never be what decides whether the bank list is fetched again.
  const paywall = useRef(onNeedsSubscription);
  paywall.current = onNeedsSubscription;

  const loadBanks = useCallback((signal?: AbortSignal) => {
    setBanksLoading(true);
    setBanksError(null);
    listBanks({ country: COUNTRY, currency: CURRENCY }, { signal })
      .then((rows) => {
        setBanks(rows);
        setBanksLoading(false);
      })
      .catch((err) => {
        if (AbortedError.is(err)) return;
        if (SessionExpiredError.is(err)) {
          // The app state moves elsewhere, but this screen must not sit on a
          // skeleton forever waiting for a list that is never coming.
          setBanksError("Your Paradigm session ended. Sign in again to continue.");
          setBanksLoading(false);
          return;
        }
        if (isEntitlementError(err)) {
          paywall.current?.();
          setBanksLoading(false);
          return;
        }
        setBanksError(describeLinkpayFailure(err));
        setBanksLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadBanks(controller.signal);
    return () => controller.abort();
  }, [loadBanks]);

  // The balance is what the amount step measures against, so it is fetched
  // early rather than at the moment the user is already typing a figure.
  useEffect(() => {
    const controller = new AbortController();
    void getBalance({ signal: controller.signal })
      .then(setBalance)
      .catch(() => {
        // A missing balance is not a blocker — it only means the amount step
        // cannot warn about overdrawing, and the gateway will refuse anyway.
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(needle));
  }, [banks, query]);

  const resolve = async () => {
    if (!bank || nuban.length !== NUBAN_LENGTH || resolving) return;
    setResolving(true);
    setResolveError(null);
    try {
      const resolution = await validateBankAccount({
        accountNumber: nuban,
        bankUuid: bank.uuid,
        country: COUNTRY,
        currency: CURRENCY,
      });
      if (resolution.accountName === "") {
        setResolveError(
          "The bank did not return a name for that number. Check the digits and the bank.",
        );
        return;
      }
      setAccountName(resolution.accountName);
      setResolvedAt(Date.now());
      setStep("review");
    } catch (err) {
      if (SessionExpiredError.is(err)) {
        setResolveError("Your Paradigm session ended. Sign in again to continue.");
        return;
      }
      if (isEntitlementError(err)) {
        paywall.current?.();
        return;
      }
      setResolveError(describeLinkpayFailure(err));
    } finally {
      setResolving(false);
    }
  };

  const handleNuban = (k: string) => {
    setResolveError(null);
    if (k === "del") {
      setNuban(nuban.slice(0, -1));
      return;
    }
    if (nuban.length >= NUBAN_LENGTH) return;
    setNuban(nuban + k);
  };

  const handleAmount = (k: string) => {
    if (k === "del") {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    if (digits === "" && k === "0") return;
    setDigits(digits + k);
  };

  /* ----------------------------------------------------------- bank step */

  if (step === "bank") {
    return (
      <Screen keyboardShouldPersistTaps="handled">
        <Head title="Send" sub="NAIRA · BANK PAYOUT" onBack={onBack} />

        <View style={{ marginTop: 22 }}>
          <Label>Destination bank</Label>
          <View
            style={{
              marginTop: 12,
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: C.hairline,
              borderRadius: 14,
              paddingHorizontal: 14,
            }}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search banks"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ height: 48, color: C.text, fontFamily: F.body, fontSize: 14.5 }}
            />
          </View>
        </View>

        {banksLoading ? (
          <Panel style={{ marginTop: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  paddingVertical: 15,
                  paddingHorizontal: 16,
                  borderBottomWidth: i === 3 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <Pulse width={42} height={42} radius={14} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Pulse width="55%" height={11} />
                  <Pulse width="30%" height={9} />
                </View>
              </View>
            ))}
          </Panel>
        ) : banksError ? (
          <View style={{ marginTop: 22 }}>
            <Body size={12.5} color={C.down} style={{ lineHeight: 18 }}>
              {banksError}
            </Body>
            <View style={{ marginTop: 16 }}>
              <GhostButton label="Try again" onPress={() => loadBanks()} />
            </View>
          </View>
        ) : filtered.length === 0 ? (
          <View style={{ marginTop: 30, alignItems: "center" }}>
            <Display size={15} color={C.sub} style={{ textAlign: "center" }}>
              {banks.length === 0 ? "No banks came back." : `No bank matches "${query.trim()}".`}
            </Display>
            <Mono size={9} color={C.dim} style={{ marginTop: 10, letterSpacing: 1.6 }}>
              {banks.length === 0 ? "TRY AGAIN IN A MOMENT" : "CHECK THE SPELLING"}
            </Mono>
          </View>
        ) : (
          <>
            <Panel style={{ marginTop: 14 }}>
              {filtered.slice(0, MAX_BANK_ROWS).map((b, i, shown) => (
                <PressableScale
                  key={b.uuid}
                  scale={0.985}
                  accessibilityLabel={`Send to an account at ${b.name}`}
                  onPress={() => {
                    setBank(b);
                    setAccountName(null);
                    setStep("account");
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderBottomWidth: i === shown.length - 1 ? 0 : 1,
                      borderBottomColor: C.hairline,
                    }}
                  >
                    <Tile text={monogram(b.name)} />
                    <View style={{ flex: 1 }}>
                      <Body size={14} semibold style={{ letterSpacing: 0.2 }} numberOfLines={1}>
                        {b.name}
                      </Body>
                      <Mono size={11} color={C.dim} style={{ marginTop: 3 }}>
                        {b.country ?? "Nigeria"} · NUBAN
                      </Mono>
                    </View>
                    <Forward />
                  </View>
                </PressableScale>
              ))}
            </Panel>
            {filtered.length > MAX_BANK_ROWS ? (
              <Mono
                size={9}
                color={C.dim}
                style={{ marginTop: 12, letterSpacing: 1.4, textAlign: "center" }}
              >
                {filtered.length - MAX_BANK_ROWS} MORE · KEEP TYPING TO NARROW IT DOWN
              </Mono>
            ) : null}
          </>
        )}
      </Screen>
    );
  }

  /* -------------------------------------------------------- account step */

  if (step === "account") {
    const complete = nuban.length === NUBAN_LENGTH;
    return (
      <View style={{ flex: 1, backgroundColor: C.canvas }}>
        <View style={{ paddingHorizontal: 22 }}>
          <Head title="Send" sub="TO A BANK ACCOUNT" onBack={() => setStep("bank")} />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 18 }}>
          <Panel>
            <Pressable
              onPress={() => setStep("bank")}
              accessibilityRole="button"
              accessibilityLabel="Change bank"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderBottomWidth: 1,
                borderBottomColor: C.hairline,
              }}
            >
              <Tile text={monogram(bank?.name ?? "")} />
              <View style={{ flex: 1 }}>
                <Body size={14} semibold numberOfLines={1}>
                  {bank?.name ?? "Pick a bank"}
                </Body>
                <Mono size={11} color={C.dim} style={{ marginTop: 3 }}>
                  {bank?.country ?? "Nigeria"} · NUBAN
                </Mono>
              </View>
              <Mono size={9} color={C.sub} style={{ letterSpacing: 1.4 }}>
                CHANGE
              </Mono>
            </Pressable>
            <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
              <Label style={{ letterSpacing: 1.6 }}>Account number</Label>
              <Text
                style={{
                  fontFamily: F.monoSemibold,
                  fontSize: 20,
                  letterSpacing: 3,
                  color: nuban ? C.text : C.dim,
                  marginTop: 10,
                }}
              >
                {groupNuban(nuban) || "0000 000 000"}
              </Text>
              <Mono size={10.5} color={resolveError ? C.down : C.dim} style={{ marginTop: 8 }}>
                {resolveError ?? "10-digit NUBAN · the rail runs the name enquiry"}
              </Mono>
            </View>
          </Panel>
        </View>

        <View style={{ marginTop: "auto", paddingHorizontal: 22, paddingBottom: 36 }}>
          <Keypad onKey={handleNuban} />
          <View style={{ marginTop: 18 }}>
            <MetallicButton
              label="Check the name"
              loading={resolving}
              disabled={!complete}
              onPress={() => void resolve()}
            />
          </View>
        </View>
      </View>
    );
  }

  /* --------------------------------------------------------- review step */

  if (step === "review") {
    return (
      <Screen>
        <Head
          title="Is this them?"
          sub="THE BANK ANSWERED"
          onBack={() => {
            setAccountName(null);
            setStep("account");
          }}
        />

        <Label style={{ color: C.brandSoft, marginTop: 26 }}>Name enquiry</Label>
        <Panel accent style={{ marginTop: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingVertical: 16,
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: C.brandGlow,
                borderWidth: 1,
                borderColor: "rgba(131,190,96,0.34)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={17} />
            </View>
            <View style={{ flex: 1 }}>
              <Body size={15} semibold style={{ letterSpacing: 0.3 }}>
                {accountName}
              </Body>
              <Mono size={11} color={C.sub} style={{ marginTop: 3, letterSpacing: 0.4 }}>
                {bank?.name} · {groupNuban(nuban)}
              </Mono>
            </View>
          </View>
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: C.hairline,
              paddingVertical: 11,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Check size={11} />
            <Mono size={9} color={C.brandSoft} style={{ letterSpacing: 1.4 }}>
              RETURNED BY {(bank?.name ?? "THE BANK").toUpperCase()}
            </Mono>
          </View>
        </Panel>

        <Body size={12.5} color={C.sub} style={{ marginTop: 16, lineHeight: 19 }}>
          This is the name the bank holds against that number. A bank transfer cannot be recalled
          once it is sent, so read it before you go on.
        </Body>

        <SectionRule space={22} />

        <MetallicButton label="Yes — that's them" onPress={() => setStep("amount")} />
        <View style={{ marginTop: 12 }}>
          <GhostButton
            label="No — change the number"
            onPress={() => {
              setAccountName(null);
              setStep("account");
            }}
          />
        </View>
      </Screen>
    );
  }

  /* --------------------------------------------------------- amount step */

  const available = balance?.available ?? null;
  let amount: ReturnType<typeof parseMoney> | null = null;
  if (digits !== "") {
    try {
      amount = parseMoney(digits, CURRENCY);
    } catch {
      amount = null;
    }
  }
  const overdrawn = overBalance(amount, available);
  const canContinue = amount !== null && !overdrawn;

  const commit = () => {
    if (!amount || !bank || !accountName || !canContinue) return;
    setPayoutDraft({
      bankUuid: bank.uuid,
      bankName: bank.name,
      accountNumber: nuban,
      accountName,
      amount,
      resolvedAt: resolvedAt ?? Date.now(),
    });
    onContinue?.();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <Head title="Send" sub="TO A BANK ACCOUNT" onBack={() => setStep("review")} />
      </View>

      <Panel
        style={{
          marginTop: 18,
          marginHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: 18,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Tile text={monogram(accountName ?? "")} accent />
        <View style={{ flex: 1 }}>
          <Body size={13.5} semibold style={{ letterSpacing: 0.2 }} numberOfLines={1}>
            {accountName}
          </Body>
          <Mono size={11} color={C.sub} style={{ marginTop: 3 }}>
            {bank?.name} · {maskAccount(nuban)}
          </Mono>
        </View>
        <Mono size={8.5} color={C.brandSoft} style={{ letterSpacing: 1.4 }}>
          VERIFIED
        </Mono>
      </Panel>

      {/* The instrument: the figure, and what backs it. */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 20 }}>
        <Panel style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
          <Label style={{ letterSpacing: 2, textAlign: "center" }}>You're sending</Label>
          <Animated.View
            style={{
              marginTop: 14,
              alignItems: "center",
              opacity: settle,
              transform: [{ translateY: lift }],
            }}
          >
            <Text
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 40,
                letterSpacing: -0.5,
                color: overdrawn ? C.down : digits ? C.text : C.dim,
              }}
            >
              <Text style={{ fontSize: 26, color: C.sub }}>₦</Text>
              {fmt(digits || "0")}
            </Text>
          </Animated.View>
          <Mono
            size={11.5}
            color={overdrawn ? C.down : C.dim}
            style={{ marginTop: 8, textAlign: "center", letterSpacing: 0.4 }}
          >
            {overdrawn ? "More than your available balance" : "Whole naira · kobo-true"}
          </Mono>

          <SectionRule space={18} />

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Mono size={9} color={C.dim} style={{ letterSpacing: 1.4 }}>
              AVAILABLE
            </Mono>
            {available ? (
              <Mono size={11.5} color={C.silver}>
                {formatMoney(available)}
              </Mono>
            ) : (
              <Pulse width={90} height={11} />
            )}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Mono size={9} color={C.dim} style={{ letterSpacing: 1.4 }}>
              FEE
            </Mono>
            <Mono size={11.5} color={C.sub}>
              Priced at confirm
            </Mono>
          </View>
        </Panel>
      </View>

      <View style={{ paddingHorizontal: 22, paddingBottom: 36 }}>
        <Keypad onKey={handleAmount} />
        <View style={{ marginTop: 18 }}>
          <MetallicButton label="Continue" disabled={!canContinue} onPress={commit} />
        </View>
      </View>
    </View>
  );
}
