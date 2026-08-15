import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackChevron,
  MetallicButton,
  Label,
  Mono,
  Body,
  Display,
  Keypad,
  SegTabs,
  PressableScale,
  SectionRule,
  Shine,
} from "../components/ui";

// Design 4d: fiat send — pick a recipient (@tag P2P or bank), then punch in the
// amount. Two moods on one screen: the recipient step is a quiet register, the
// amount step is an instrument panel where the figure settles rather than jumps.
type Recipient = {
  title: string;
  sub: string;
  initials: string;
  internal?: boolean;
};

const tagRecipients: Recipient[] = [
  { title: "Tobi Adeyemi", sub: "@tobi", initials: "TA", internal: true },
  { title: "Amara Okafor", sub: "@amara", initials: "AO", internal: true },
  { title: "Kofi Mensah", sub: "@kofi", initials: "KM", internal: true },
];

const bankRecipient: Recipient = {
  title: "ADEBAYO KEHINDE",
  sub: "GTBank · 0123 456 789",
  initials: "AK",
};

const balance = "₦482,650.00";
const RATE = 1545; // ₦ per $ — mock, matches the fiat space subline.
const MAX_DIGITS = 7;

const fmt = (d: string) => d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function usdApprox(digits: string) {
  const n = parseInt(digits || "0", 10);
  const usd = n / RATE;
  const whole = Math.floor(usd);
  const cents = String(Math.round((usd - whole) * 100)).padStart(2, "0");
  return `≈ $${fmt(String(whole))}.${cents} USD`;
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
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingTop: 10,
      }}
    >
      <Pressable
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <BackChevron />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Display size={20}>{title}</Display>
        <Mono
          size={9.5}
          color={C.dim}
          style={{ marginTop: 3, letterSpacing: 1.4 }}
        >
          {sub}
        </Mono>
      </View>
    </View>
  );
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

function Avatar({
  initials,
  internal,
}: {
  initials: string;
  internal?: boolean;
}) {
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: internal ? C.brandGlow : C.inset,
        borderWidth: 1,
        borderColor: internal ? "rgba(131,190,96,0.28)" : C.hairline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: 12.5,
          letterSpacing: 0.8,
          color: internal ? C.brandSoft : C.silver,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

/** Quiet marker: this @tag lives inside Paradigm, so nothing leaves the house. */
function HouseChip() {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: C.hairline,
        backgroundColor: C.inset,
      }}
    >
      <Mono size={8.5} color={C.sub} style={{ letterSpacing: 1.4 }}>
        PARADIGM
      </Mono>
    </View>
  );
}

function SealChip() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Check size={12} />
      <Mono size={8.5} color={C.brandSoft} style={{ letterSpacing: 1.4 }}>
        VERIFIED
      </Mono>
    </View>
  );
}

function RecipientRow({
  r,
  onPress,
  last,
}: {
  r: Recipient;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scale={0.985}
      accessibilityLabel={`Send to ${r.title}`}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: C.hairline,
        }}
      >
        <Avatar initials={r.initials} internal={r.internal} />
        <View style={{ flex: 1 }}>
          <Body size={14} semibold style={{ letterSpacing: 0.2 }}>
            {r.title}
          </Body>
          <Mono
            size={11}
            color={C.sub}
            style={{ marginTop: 3, letterSpacing: 0.4 }}
          >
            {r.sub}
          </Mono>
        </View>
        {r.internal ? <HouseChip /> : <SealChip />}
      </View>
    </PressableScale>
  );
}

export default function SendScreen({
  onBack,
  onContinue,
}: {
  onBack?: () => void;
  onContinue?: () => void;
}) {
  const [step, setStep] = useState<"recipient" | "amount">("recipient");
  const [tab, setTab] = useState(0);
  const [recipient, setRecipient] = useState<Recipient>(tagRecipients[0]);
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
  const lift = settle.interpolate({
    inputRange: [0, 1],
    outputRange: [5, 0],
  });

  const pick = (r: Recipient) => {
    setRecipient(r);
    setStep("amount");
  };

  const handleKey = (k: string) => {
    if (k === "del") {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (digits.length >= MAX_DIGITS) return;
    if (digits === "" && k === "0") return;
    setDigits(digits + k);
  };

  if (step === "recipient") {
    return (
      <Screen>
        <Head title="Send" sub="NAIRA · INSTANT RAIL" onBack={onBack} />
        <View
          style={{
            marginTop: 22,
            backgroundColor: C.raised,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.hairline,
            padding: 4,
          }}
        >
          <SegTabs
            tabs={["@tag", "Bank account"]}
            active={tab}
            onChange={setTab}
            tone="ghost"
          />
        </View>

        {tab === 0 ? (
          <View style={{ marginTop: 26 }}>
            <Label>Recent</Label>
            <Panel style={{ marginTop: 12 }}>
              {tagRecipients.map((r, i) => (
                <RecipientRow
                  key={r.sub}
                  r={r}
                  onPress={() => pick(r)}
                  last={i === tagRecipients.length - 1}
                />
              ))}
            </Panel>
            <SectionRule space={22} />
            {/* The register closes on a statement rather than trailing off
                into empty canvas — the quiet half of an empty state. */}
            <View style={{ alignItems: "center" }}>
              <Display size={15} color={C.sub} style={{ textAlign: "center" }}>
                Instant between Paradigm accounts.
              </Display>
              <Mono
                size={9}
                color={C.dim}
                style={{ marginTop: 10, letterSpacing: 1.6 }}
              >
                NO RAIL · NO WAIT · NO FEE
              </Mono>
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 26 }}>
            <Label>Destination</Label>
            <Panel style={{ marginTop: 12 }}>
              <View
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
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    backgroundColor: C.inset,
                    borderWidth: 1,
                    borderColor: C.hairline,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Mono
                    size={12}
                    color={C.silver}
                    style={{ letterSpacing: 0.8 }}
                  >
                    GT
                  </Mono>
                </View>
                <View style={{ flex: 1 }}>
                  <Body size={14} semibold>
                    GTBank
                  </Body>
                  <Mono size={11} color={C.dim} style={{ marginTop: 3 }}>
                    Nigeria · NUBAN
                  </Mono>
                </View>
                <Mono size={9} color={C.sub} style={{ letterSpacing: 1.4 }}>
                  CHANGE
                </Mono>
              </View>
              <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
                <Label style={{ letterSpacing: 1.6 }}>Account number</Label>
                <Text
                  style={{
                    fontFamily: F.monoSemibold,
                    fontSize: 20,
                    letterSpacing: 3,
                    color: C.text,
                    marginTop: 10,
                  }}
                >
                  0123 456 789
                </Text>
                <Mono size={10.5} color={C.dim} style={{ marginTop: 8 }}>
                  10-digit NUBAN · the rail runs the name enquiry
                </Mono>
              </View>
            </Panel>

            <SectionRule space={22} />

            <Label style={{ color: C.brandSoft }}>Name enquiry</Label>
            <Panel accent style={{ marginTop: 12 }}>
              <PressableScale
                onPress={() => pick(bankRecipient)}
                scale={0.985}
                accessibilityLabel={`Send to ${bankRecipient.title}`}
              >
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
                    <Body size={14} semibold style={{ letterSpacing: 0.3 }}>
                      {bankRecipient.title}
                    </Body>
                    <Mono
                      size={11}
                      color={C.sub}
                      style={{ marginTop: 3, letterSpacing: 0.4 }}
                    >
                      {bankRecipient.sub}
                    </Mono>
                  </View>
                  <Forward />
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
                  <Mono
                    size={9}
                    color={C.brandSoft}
                    style={{ letterSpacing: 1.4 }}
                  >
                    RETURNED BY GTBANK
                  </Mono>
                </View>
              </PressableScale>
            </Panel>
          </View>
        )}
      </Screen>
    );
  }

  const canContinue = digits !== "";

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <View style={{ paddingHorizontal: 22 }}>
        <Head
          title="Send"
          sub={recipient.internal ? "TO A PARADIGM TAG" : "TO A BANK ACCOUNT"}
          onBack={() => setStep("recipient")}
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
        <Avatar initials={recipient.initials} internal={recipient.internal} />
        <View style={{ flex: 1 }}>
          <Body size={13.5} semibold style={{ letterSpacing: 0.2 }}>
            {recipient.title}
          </Body>
          <Mono size={11} color={C.sub} style={{ marginTop: 3 }}>
            {recipient.sub}
          </Mono>
        </View>
        {recipient.internal ? (
          <HouseChip />
        ) : (
          <Mono size={8.5} color={C.dim} style={{ letterSpacing: 1.4 }}>
            VERIFIED
          </Mono>
        )}
      </Panel>

      {/* The instrument: the figure, its dollar shadow, and what backs it. */}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: 20,
        }}
      >
        <Panel style={{ paddingVertical: 24, paddingHorizontal: 20 }}>
          <Label style={{ letterSpacing: 2, textAlign: "center" }}>
            You're sending
          </Label>
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
                color: digits ? C.text : C.dim,
              }}
            >
              <Text style={{ fontSize: 26, color: C.sub }}>₦</Text>
              {fmt(digits || "0")}
            </Text>
          </Animated.View>
          <Mono
            size={11.5}
            color={C.dim}
            style={{ marginTop: 8, textAlign: "center", letterSpacing: 0.4 }}
          >
            {usdApprox(digits)}
          </Mono>

          <SectionRule space={18} />

          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Mono size={9} color={C.dim} style={{ letterSpacing: 1.4 }}>
              AVAILABLE
            </Mono>
            <Mono size={11.5} color={C.silver}>
              {balance}
            </Mono>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
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
        <Keypad onKey={handleKey} />
        <View
          style={{ marginTop: 18, opacity: canContinue ? 1 : 0.4 }}
          pointerEvents={canContinue ? "auto" : "none"}
        >
          <MetallicButton label="Continue" onPress={onContinue} />
        </View>
      </View>
    </View>
  );
}
