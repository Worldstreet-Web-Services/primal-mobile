import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { C } from "../theme/tokens";
import { cn } from "@/lib/cn";

/**
 * Design 4d, rewired: a naira payout to a Nigerian bank account.
 *
 * The mock build offered a second rail — @tag payments between KashPlus
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
  const words = name
    .replace(/[^A-Za-z ]/g, "")
    .trim()
    .split(/\s+/);
  if (words.length === 0 || words[0] === "") return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function Check({
  size = 13,
  color = C.brandSoft,
}: {
  size?: number;
  color?: string;
}) {
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
function Head({
  title,
  sub,
  onBack,
}: {
  title: string;
  sub: string;
  onBack?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-[12px] pt-[10px]">
      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <BackChevron />
      </Pressable>
      <View className="flex-1">
        <Display className="text-[20px] leading-[21px]">{title}</Display>
        <Mono className="text-[9.5px] text-dim mt-[3px] tracking-[1.4px]">
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
      className="bg-canvas-raised border rounded-[20px] overflow-hidden"
      style={[
        {
          borderColor: accent ? "rgba(131,190,96,0.32)" : C.hairline,
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
      className={cn(
        "w-[42px] h-[42px] border items-center justify-center",
        accent ? "bg-brand-glow" : "bg-canvas-inset",
      )}
      style={{
        borderRadius: accent ? 21 : 14,
        borderColor: accent ? "rgba(131,190,96,0.28)" : C.hairline,
      }}
    >
      <Text
        className={cn(
          "font-mono-semibold text-[12.5px] tracking-[0.8px]",
          accent ? "text-brand-soft" : "text-silver",
        )}
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
  const settle = useMemo(() => new Animated.Value(0), []);
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
          setBanksError(
            "Your KashPlus session ended. Sign in again to continue.",
          );
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
        setResolveError(
          "Your KashPlus session ended. Sign in again to continue.",
        );
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

        <View className="mt-[22px]">
          <Label>Destination bank</Label>
          <View className="mt-[12px] bg-canvas-raised border border-rule rounded-[14px] px-[14px]">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search banks"
              placeholderTextColor={C.dim}
              autoCapitalize="none"
              autoCorrect={false}
              className="h-[48px] text-text font-body text-[14.5px]"
            />
          </View>
        </View>

        {banksLoading ? (
          <Panel style={{ marginTop: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                className="flex-row items-center gap-[14px] py-[15px] px-[16px] border-b-rule"
                style={{
                  borderBottomWidth: i === 3 ? 0 : 1,
                }}
              >
                <Pulse width={42} height={42} radius={14} />
                <View className="flex-1 gap-[7px]">
                  <Pulse width="55%" height={11} />
                  <Pulse width="30%" height={9} />
                </View>
              </View>
            ))}
          </Panel>
        ) : banksError ? (
          <View className="mt-[22px]">
            <Body className="text-[12.5px] text-down leading-[18px]">
              {banksError}
            </Body>
            <View className="mt-[16px]">
              <GhostButton label="Try again" onPress={() => loadBanks()} />
            </View>
          </View>
        ) : filtered.length === 0 ? (
          <View className="mt-[30px] items-center">
            <Display className="text-[15px] leading-[15.75px] text-sub text-center">
              {banks.length === 0
                ? "No banks came back."
                : `No bank matches "${query.trim()}".`}
            </Display>
            <Mono className="text-[9px] text-dim mt-[10px] tracking-[1.6px]">
              {banks.length === 0
                ? "TRY AGAIN IN A MOMENT"
                : "CHECK THE SPELLING"}
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
                    className="flex-row items-center gap-[14px] py-[14px] px-[16px] border-b-rule"
                    style={{
                      borderBottomWidth: i === shown.length - 1 ? 0 : 1,
                    }}
                  >
                    <Tile text={monogram(b.name)} />
                    <View className="flex-1">
                      <Body
                        className="text-[14px] font-body-semibold tracking-[0.2px]"

                        numberOfLines={1}
                      >
                        {b.name}
                      </Body>
                      <Mono className="text-[11px] text-dim mt-[3px]">
                        {b.country ?? "Nigeria"} · NUBAN
                      </Mono>
                    </View>
                    <Forward />
                  </View>
                </PressableScale>
              ))}
            </Panel>
            {filtered.length > MAX_BANK_ROWS ? (
              <Mono className="text-[9px] text-dim mt-[12px] tracking-[1.4px] text-center">
                {filtered.length - MAX_BANK_ROWS} MORE · KEEP TYPING TO NARROW
                IT DOWN
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
      <View className="flex-1 bg-canvas">
        <View className="px-[22px]">
          <Head
            title="Send"
            sub="TO A BANK ACCOUNT"
            onBack={() => setStep("bank")}
          />
        </View>

        <View className="px-[20px] mt-[18px]">
          <Panel>
            <Pressable
              onPress={() => setStep("bank")}
              accessibilityRole="button"
              accessibilityLabel="Change bank"
              className="flex-row items-center gap-[14px] py-[14px] px-[16px] border-b border-b-rule"
            >
              <Tile text={monogram(bank?.name ?? "")} />
              <View className="flex-1">
                <Body
                  className="text-[14px] font-body-semibold"
                  numberOfLines={1}
                >
                  {bank?.name ?? "Pick a bank"}
                </Body>
                <Mono className="text-[11px] text-dim mt-[3px]">
                  {bank?.country ?? "Nigeria"} · NUBAN
                </Mono>
              </View>
              <Mono className="text-[9px] text-sub tracking-[1.4px]">
                CHANGE
              </Mono>
            </Pressable>
            <View className="py-[16px] px-[16px]">
              <Label className="tracking-[1.6px]">Account number</Label>
              <Text
                className={cn(
                  "font-mono-semibold text-[20px] tracking-[3px] mt-[10px]",
                  nuban ? "text-text" : "text-dim",
                )}
              >
                {groupNuban(nuban) || "0000 000 000"}
              </Text>
              <Mono
                size={10.5}

                className={cn(
                  "mt-[8px]",
                  resolveError ? "text-down" : "text-dim",
                )}
              >
                {resolveError ??
                  "10-digit NUBAN · the rail runs the name enquiry"}
              </Mono>
            </View>
          </Panel>
        </View>

        <View
          className="px-[22px] pb-[36px]"
          style={{
            marginTop: "auto",
          }}
        >
          <Keypad onKey={handleNuban} />
          <View className="mt-[18px]">
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

        <Label className="text-brand-soft mt-[26px]">Name enquiry</Label>
        <Panel accent style={{ marginTop: 12 }}>
          <View className="flex-row items-center gap-[14px] py-[16px] px-[16px]">
            <View
              className="w-[42px] h-[42px] rounded-[21px] bg-brand-glow border items-center justify-center"
              style={{
                borderColor: "rgba(131,190,96,0.34)",
              }}
            >
              <Check size={17} />
            </View>
            <View className="flex-1">
              <Body className="text-[15px] font-body-semibold tracking-[0.3px]">
                {accountName}
              </Body>
              <Mono className="text-[11px] text-sub mt-[3px] tracking-[0.4px]">
                {bank?.name} · {groupNuban(nuban)}
              </Mono>
            </View>
          </View>
          <View className="border-t border-t-rule py-[11px] px-[16px] flex-row items-center gap-[6px]">
            <Check size={11} />
            <Mono className="text-[9px] text-brand-soft tracking-[1.4px]">
              RETURNED BY {(bank?.name ?? "THE BANK").toUpperCase()}
            </Mono>
          </View>
        </Panel>

        <Body className="text-[12.5px] text-sub mt-[16px] leading-[19px]">
          This is the name the bank holds against that number. A bank transfer
          cannot be recalled once it is sent, so read it before you go on.
        </Body>

        <SectionRule space={22} />

        <MetallicButton
          label="Yes — that's them"
          onPress={() => setStep("amount")}
        />
        <View className="mt-[12px]">
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
    <View className="flex-1 bg-canvas">
      <View className="px-[22px]">
        <Head
          title="Send"
          sub="TO A BANK ACCOUNT"
          onBack={() => setStep("review")}
        />
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
        <View className="flex-1">
          <Body
            className="text-[13.5px] font-body-semibold tracking-[0.2px]"

            numberOfLines={1}
          >
            {accountName}
          </Body>
          <Mono className="text-[11px] text-sub mt-[3px]">
            {bank?.name} · {maskAccount(nuban)}
          </Mono>
        </View>
        <Mono className="text-[8.5px] text-brand-soft tracking-[1.4px]">
          VERIFIED
        </Mono>
      </Panel>

      {/* The instrument: the figure, and what backs it. */}
      <View className="flex-1 justify-center px-[20px] py-[20px]">
        <Panel style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
          <Label className="tracking-[2px] text-center">You're sending</Label>
          <Animated.View
            className="mt-[14px] items-center"
            style={{
              opacity: settle,
              transform: [{ translateY: lift }],
            }}
          >
            <Text
              className="font-mono-semibold text-[40px] tracking-[-0.5px]"
              style={{
                color: overdrawn ? C.down : digits ? C.text : C.dim,
              }}
            >
              <Text className="text-[26px] text-sub">₦</Text>
              {fmt(digits || "0")}
            </Text>
          </Animated.View>
          <Mono
            size={11.5}

            className={cn(
              "mt-[8px] text-center tracking-[0.4px]",
              overdrawn ? "text-down" : "text-dim",
            )}
          >
            {overdrawn
              ? "More than your available balance"
              : "Whole naira · kobo-true"}
          </Mono>

          <SectionRule space={18} />

          <View className="flex-row justify-between">
            <Mono className="text-[9px] text-dim tracking-[1.4px]">
              AVAILABLE
            </Mono>
            {available ? (
              <Mono className="text-[11.5px] text-silver">
                {formatMoney(available)}
              </Mono>
            ) : (
              <Pulse width={90} height={11} />
            )}
          </View>
          <View className="flex-row justify-between mt-[8px]">
            <Mono className="text-[9px] text-dim tracking-[1.4px]">FEE</Mono>
            <Mono className="text-[11.5px] text-sub">Priced at confirm</Mono>
          </View>
        </Panel>
      </View>

      <View className="px-[22px] pb-[36px]">
        <Keypad onKey={handleAmount} />
        <View className="mt-[18px]">
          <MetallicButton
            label="Continue"
            disabled={!canContinue}
            onPress={commit}
          />
        </View>
      </View>
    </View>
  );
}
