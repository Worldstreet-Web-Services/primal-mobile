import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  GhostButton,
  Card,
  Label,
  Mono,
  Body,
  Display,
  PressableScale,
  PulseDot,
  Shine,
} from "../components/ui";
import { CopyField, useCopy } from "../components/CopyAction";
import { QrPlate } from "../components/QrPlate";

// Fund wallet — the money-in hub, modeled on Ark's production flow.
// Step 1 picks a method. Bank transfer hands off to its own screen
// (/fund-bank, the amount → one-off account → settle walk), while the
// crypto flow runs right here the way Ark's addfunds page does:
// what are you sending → which network → the deposit address.

type Step = "method" | "token" | "network" | "address";

type Net = { key: string; label: string; min: string; addr: string };

// Local mocks — the shared mock stays untouched. Addresses mirror the
// ReceiveSheet set so the demo reads consistent across surfaces.
const NETWORKS: Net[] = [
  {
    key: "solana",
    label: "Solana",
    min: "$2",
    addr: "9xJdW2vNqPh4tR8kFzLm3QbC5sYwQm2P",
  },
  {
    key: "base",
    label: "Base",
    min: "$2",
    addr: "0x7A3fD24b81cE5501a2Fb44C09E4c88A1",
  },
  {
    key: "ethereum",
    label: "Ethereum",
    min: "$12",
    addr: "0x7A3fD24b81cE5501a2Fb44C09E4c88A1",
  },
  {
    key: "tron",
    label: "Tron",
    min: "$4",
    addr: "TQm4xW8pKvN2dR7hLcE9fBzA3sYw2Kd",
  },
  {
    key: "bitcoin",
    label: "Bitcoin",
    min: "$10",
    addr: "bc1q8w2p4kvn2dr7hlce9fbza3syw2kd94x",
  },
  {
    key: "bsc",
    label: "BNB Chain",
    min: "$2",
    addr: "0x7A3fD24b81cE5501a2Fb44C09E4c88A1",
  },
  {
    key: "polygon",
    label: "Polygon",
    min: "$2",
    addr: "0x7A3fD24b81cE5501a2Fb44C09E4c88A1",
  },
  {
    key: "arbitrum",
    label: "Arbitrum",
    min: "$2",
    addr: "0x7A3fD24b81cE5501a2Fb44C09E4c88A1",
  },
];

type Tok = { sym: string; name: string; nets: string[] };

const TOKENS: Tok[] = [
  {
    sym: "USDC",
    name: "USD Coin",
    nets: ["solana", "base", "ethereum", "arbitrum", "polygon"],
  },
  {
    sym: "USDT",
    name: "Tether USD",
    nets: ["tron", "ethereum", "bsc", "polygon"],
  },
  { sym: "BTC", name: "Bitcoin", nets: ["bitcoin"] },
  { sym: "ETH", name: "Ethereum", nets: ["ethereum", "base", "arbitrum"] },
  { sym: "SOL", name: "Solana", nets: ["solana"] },
  { sym: "BNB", name: "BNB", nets: ["bsc"] },
  { sym: "TRX", name: "Tron", nets: ["tron"] },
  { sym: "POL", name: "Polygon", nets: ["polygon"] },
  { sym: "DAI", name: "Dai", nets: ["ethereum", "base"] },
];

// The short list shown by default; the rest hide behind "More tokens".
const POPULAR = ["USDC", "USDT", "BTC", "ETH", "SOL"];

// Curated token-on-network pairs surfaced above the list — one tap lands
// on the address step directly (Ark's spotlight-pairs pattern).
const SPOTLIGHT: { sym: string; net: string }[] = [
  { sym: "USDC", net: "solana" },
  { sym: "USDC", net: "base" },
  { sym: "USDT", net: "tron" },
  { sym: "BTC", net: "bitcoin" },
  { sym: "ETH", net: "ethereum" },
];

/** How often the screen re-states that it is still watching the chain. */
const POLL_MS = 8_000;

const netsFor = (t: Tok) => NETWORKS.filter((n) => t.nets.includes(n.key));

/**
 * Letterform token mark. Four-character symbols keep all four at a tighter
 * size rather than truncating — clipping to three turned USDC and USDT into
 * the same "USD" badge, which is the one distinction that surface exists to
 * draw.
 */
function TokenBadge({ sym, size = 38 }: { sym: string; size?: number }) {
  const long = sym.length > 3;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.inset,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: size * 0.25,
          right: size * 0.25,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      />
      <Text
        style={{
          fontFamily: F.monoSemibold,
          fontSize: long ? size * 0.235 : size * 0.28,
          letterSpacing: long ? -0.2 : 0.2,
          color: C.silver,
        }}
      >
        {sym}
      </Text>
    </View>
  );
}

function Chevron({ color = C.dim }: { color?: string }) {
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

function SearchGlyph() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24">
      <Circle
        cx={11}
        cy={11}
        r={6.5}
        stroke={C.dim}
        strokeWidth={1.8}
        fill="none"
      />
      <Path
        d="m16 16 4 4"
        stroke={C.dim}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Collapsed "picked" summary row with a Change link. */
function SelectedRow({
  sym,
  label,
  onChange,
}: {
  sym: string;
  label: React.ReactNode;
  onChange: () => void;
}) {
  return (
    <Card
      style={{
        marginTop: 12,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <TokenBadge sym={sym} size={32} />
      <View style={{ flex: 1 }}>{label}</View>
      <Pressable onPress={onChange} hitSlop={10}>
        <Mono size={10} color={C.brandSoft} style={{ letterSpacing: 1.5 }}>
          CHANGE
        </Mono>
      </Pressable>
    </Card>
  );
}

/**
 * A funding method as a full plate rather than a list line. The method choice
 * is the only decision on that step, so it gets the room it deserves.
 */
function MethodPlate({
  title,
  sub,
  detail,
  glyph,
  tag,
  onPress,
}: {
  title: string;
  sub: string;
  detail: string;
  glyph: React.ReactNode;
  /** The one recommended route carries a mark; the rest stay unmarked. */
  tag?: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scale={0.985}>
      <View
        accessibilityRole="button"
        accessibilityLabel={title}
        style={{
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 20,
          padding: 16,
          overflow: "hidden",
        }}
      >
        <Shine />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              backgroundColor: C.inset,
              borderWidth: 1,
              borderColor: C.hairline,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {glyph}
          </View>
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Body size={15} semibold>
                {title}
              </Body>
              {tag ? (
                <View
                  style={{
                    borderRadius: 99,
                    borderWidth: 1,
                    borderColor: "rgba(131,190,96,0.4)",
                    backgroundColor: C.brandGlow,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <Mono size={8.5} color={C.brandSoft} style={{ letterSpacing: 1.2 }}>
                    {tag}
                  </Mono>
                </View>
              ) : null}
            </View>
            <Body size={12} color={C.sub} style={{ marginTop: 3 }}>
              {sub}
            </Body>
          </View>
          <Chevron />
        </View>
        <View
          style={{
            marginTop: 13,
            paddingTop: 11,
            borderTopWidth: 1,
            borderTopColor: C.hairline,
          }}
        >
          <Mono size={10} color={C.dim} style={{ letterSpacing: 1.1 }}>
            {detail}
          </Mono>
        </View>
      </View>
    </PressableScale>
  );
}

function BankGlyph() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M3 9.5 12 4l9 5.5M5 10v8m4.5-8v8m5-8v8m4.5-8v8M3 20h18"
        stroke={C.silver}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function ChainGlyph() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M10 14a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.1 1.1M14 10a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.1-1.1"
        stroke={C.silver}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default function FundScreen({
  onBack,
  onBankTransfer,
  onOpenReceive,
}: {
  onBack?: () => void;
  /** Bank transfer is its own screen — amount, one-off account, settle. */
  onBankTransfer?: () => void;
  onOpenReceive?: () => void;
}) {
  const [step, setStep] = useState<Step>("method");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [tok, setTok] = useState<Tok | null>(null);
  const [net, setNet] = useState<Net | null>(null);
  // The address "mints" for a beat before it shows — the flow reads as
  // provisioning a real one, and the loading state gets exercised.
  const [ready, setReady] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const { copied, copy } = useCopy();

  // Watch narration: the same "checked Ns ago" cadence the bank screen runs,
  // so a wait on either rail reads as attended rather than abandoned.
  const [now, setNow] = useState(() => Date.now());
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  // The address plate settles into place once minted — the single motion
  // moment on this screen.
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step !== "address") return;
    setReady(false);
    enter.setValue(0);
    const t = setTimeout(() => {
      setReady(true);
      Animated.spring(enter, {
        toValue: 1,
        useNativeDriver: true,
        speed: 13,
        bounciness: 4,
      }).start();
    }, 900);
    return () => clearTimeout(t);
  }, [step, net, enter]);

  useEffect(() => {
    if (step !== "address" || !ready) return;
    setNow(Date.now());
    setLastChecked(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    const poll = setInterval(() => setLastChecked(Date.now()), POLL_MS);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [step, ready]);

  const q = query.trim().toLowerCase();
  const visible = q
    ? TOKENS.filter(
        (t) => t.sym.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
      )
    : showAll
      ? TOKENS
      : TOKENS.filter((t) => POPULAR.includes(t.sym));
  const hidden = TOKENS.length - visible.length;

  const back = () => {
    if (step === "address") {
      setStep("network");
      setNet(null);
      return;
    }
    if (step === "network") {
      setStep("token");
      setTok(null);
      return;
    }
    if (step === "token") {
      setStep("method");
      return;
    }
    onBack && onBack();
  };

  const pickPair = (symKey: string, netKey: string) => {
    const t = TOKENS.find((x) => x.sym === symKey);
    const n = NETWORKS.find((x) => x.key === netKey);
    if (!t || !n) return;
    setTok(t);
    setNet(n);
    setStep("address");
  };

  const refresh = () => {
    setLastChecked(Date.now());
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 1600);
  };

  const title =
    step === "method"
      ? "Add funds"
      : step === "token"
        ? "What are you sending?"
        : step === "network"
          ? `Send ${tok ? tok.sym : ""} from…`
          : `Fund with ${tok ? tok.sym : ""}`;

  const checkedAgo =
    lastChecked === null
      ? null
      : Math.max(0, Math.round((now - lastChecked) / 1000));

  return (
    <Screen>
      <BackHeader title={title} onBack={back} />

      {step === "method" ? (
        <View style={{ marginTop: 18 }}>
          <Display size={19} color={C.silver} style={{ lineHeight: 27 }}>
            Two ways in. Both land as naira,{"\n"}both land in your name.
          </Display>

          <Label style={{ marginTop: 26 }}>Choose a route</Label>
          <View style={{ marginTop: 12, gap: 12 }}>
            <MethodPlate
              title="Bank transfer"
              sub="A one-off account, issued to you for this transfer."
              detail="NO FEE · CLEARS IN UNDER 10S"
              glyph={<BankGlyph />}
              tag="FASTEST"
              onPress={onBankTransfer}
            />
            <MethodPlate
              title="Crypto deposit"
              sub="Send from any chain. It converts on arrival."
              detail="8 NETWORKS · CREDITED AT FILL"
              glyph={<ChainGlyph />}
              onPress={() => setStep("token")}
            />
          </View>

          <View
            style={{
              marginTop: 26,
              paddingTop: 18,
              borderTopWidth: 1,
              borderTopColor: C.hairline,
            }}
          >
            <GhostButton
              label="Show my account details"
              onPress={onOpenReceive}
            />
            <Body
              size={11}
              color={C.dim}
              style={{ textAlign: "center", marginTop: 14, lineHeight: 17 }}
            >
              Your number and deposit codes, ready to hand to someone else.
            </Body>
          </View>
        </View>
      ) : null}

      {step === "token" ? (
        <View style={{ marginTop: 8 }}>
          <Body size={12.5} color={C.sub}>
            Whatever you send arrives as ₦ in your balance.
          </Body>

          <Label style={{ marginTop: 22 }}>Most sent</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 12, marginHorizontal: -20 }}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}
          >
            {SPOTLIGHT.map((p) => {
              const n = NETWORKS.find((x) => x.key === p.net);
              if (!n) return null;
              return (
                <PressableScale
                  key={p.sym + p.net}
                  onPress={() => pickPair(p.sym, p.net)}
                  scale={0.97}
                >
                  <View
                    accessibilityRole="button"
                    accessibilityLabel={`${p.sym} on ${n.label}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 11,
                      backgroundColor: C.raised,
                      borderWidth: 1,
                      borderColor: C.border,
                      borderRadius: 16,
                      paddingVertical: 11,
                      paddingLeft: 11,
                      paddingRight: 16,
                      overflow: "hidden",
                    }}
                  >
                    <Shine />
                    <TokenBadge sym={p.sym} size={32} />
                    <View>
                      <Body size={13} semibold>
                        {p.sym}
                      </Body>
                      <Mono size={10} color={C.dim} style={{ marginTop: 2 }}>
                        {n.label} · min {n.min}
                      </Mono>
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </ScrollView>

          <View
            style={{
              marginTop: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: C.key,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 16,
              paddingHorizontal: 15,
            }}
          >
            <SearchGlyph />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search tokens"
              placeholderTextColor={C.dim}
              style={{
                flex: 1,
                paddingVertical: 13,
                color: C.text,
                fontFamily: F.body,
                fontSize: 14,
              }}
            />
          </View>

          <Card style={{ marginTop: 12, paddingVertical: 4 }}>
            {visible.map((t, i) => (
              <Pressable
                key={t.sym}
                onPress={() => {
                  setTok(t);
                  setStep("network");
                }}
                accessibilityRole="button"
                accessibilityLabel={t.sym}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                  paddingVertical: 13,
                  borderBottomWidth: i === visible.length - 1 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <TokenBadge sym={t.sym} />
                <View style={{ flex: 1 }}>
                  <Body size={14} semibold>
                    {t.sym}
                  </Body>
                  <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>
                    {t.name}
                  </Body>
                </View>
                <Mono size={10.5} color={C.dim}>
                  {t.nets.length} {t.nets.length === 1 ? "NETWORK" : "NETWORKS"}
                </Mono>
                <Chevron />
              </Pressable>
            ))}
            {visible.length === 0 ? (
              <View style={{ paddingVertical: 26, alignItems: "center" }}>
                <Body size={13} color={C.sub} semibold>
                  Nothing by that name
                </Body>
                <Body
                  size={11.5}
                  color={C.dim}
                  style={{ marginTop: 5, textAlign: "center" }}
                >
                  Try the ticker — USDC, BTC, SOL.
                </Body>
              </View>
            ) : null}
          </Card>

          {!q && !showAll && hidden > 0 ? (
            <Pressable
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              style={{
                marginTop: 12,
                alignItems: "center",
                paddingVertical: 13,
                borderRadius: 99,
                borderWidth: 1,
                borderColor: C.border,
                backgroundColor: C.card,
              }}
            >
              <Mono size={11} color={C.silver} style={{ letterSpacing: 1.4 }}>
                MORE TOKENS · {hidden}
              </Mono>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {step === "network" && tok ? (
        <View style={{ marginTop: 8 }}>
          <Body size={12.5} color={C.sub}>
            Pick the network you're sending on. It has to match the one you
            send from.
          </Body>

          <SelectedRow
            sym={tok.sym}
            label={
              <Body size={14} semibold>
                {tok.sym}
              </Body>
            }
            onChange={() => {
              setTok(null);
              setStep("token");
            }}
          />

          <Card style={{ marginTop: 12, paddingVertical: 4 }}>
            {netsFor(tok).map((n, i, arr) => (
              <Pressable
                key={n.key}
                onPress={() => {
                  setNet(n);
                  setStep("address");
                }}
                accessibilityRole="button"
                accessibilityLabel={n.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                  borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <Body size={14} semibold style={{ flex: 1 }}>
                  {n.label}
                </Body>
                <Mono size={10.5} color={C.dim}>
                  MIN {n.min}
                </Mono>
                <Chevron />
              </Pressable>
            ))}
            {netsFor(tok).length === 0 ? (
              <View style={{ paddingVertical: 26, alignItems: "center" }}>
                <Body size={13} color={C.sub} semibold>
                  No route for {tok.sym} yet
                </Body>
                <Body
                  size={11.5}
                  color={C.dim}
                  style={{ marginTop: 5, textAlign: "center" }}
                >
                  Send a stablecoin instead — it lands the same way.
                </Body>
              </View>
            ) : null}
          </Card>
        </View>
      ) : null}

      {step === "address" && tok && net ? (
        <View style={{ marginTop: 8 }}>
          <SelectedRow
            sym={tok.sym}
            label={
              <Body size={14} semibold>
                {tok.sym}
                <Body size={14} color={C.dim}>
                  {" "}
                  on{" "}
                </Body>
                {net.label}
              </Body>
            }
            onChange={() => {
              setNet(null);
              setStep("network");
            }}
          />

          {!ready ? (
            <View style={{ marginTop: 26, alignItems: "center" }}>
              <View
                style={{
                  width: 196,
                  height: 196,
                  borderRadius: 26,
                  backgroundColor: C.raised,
                  borderWidth: 1,
                  borderColor: C.hairline,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PulseDot color={C.brandSoft} size={7} />
              </View>
              <Mono
                size={10}
                color={C.dim}
                style={{ marginTop: 18, letterSpacing: 1.5 }}
              >
                MINTING YOUR {net.label.toUpperCase()} ADDRESS
              </Mono>
            </View>
          ) : (
            <Animated.View
              style={{
                opacity: enter,
                transform: [
                  {
                    translateY: enter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              }}
            >
              <QrPlate
                value={net.addr}
                size={172}
                caption={`${tok.sym} · ${net.label}`}
                style={{ marginTop: 20 }}
              />

              <CopyField
                onPress={() => void copy("addr", net.addr)}
                copied={copied === "addr"}
                label="COPY"
                accessibilityLabel="Copy deposit address"
                style={{ marginTop: 18 }}
              >
                <Mono
                  size={12.5}
                  color={C.text}
                  style={{ fontFamily: F.monoSemibold, lineHeight: 19 }}
                >
                  {net.addr}
                </Mono>
              </CopyField>

              {/* One accent block on this view. The safety rule and the floor
                  are the same instruction — split across two coloured slabs
                  they read as two alarms instead of one set of terms. */}
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: C.brandGlow,
                  borderWidth: 1,
                  borderColor: "rgba(131,190,96,0.35)",
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <Body size={12.5} color={C.brandSoft} style={{ lineHeight: 18 }}>
                  Send only {tok.sym} on {net.label}. Another asset or another
                  chain cannot be recovered.
                </Body>
                <View
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(131,190,96,0.2)",
                  }}
                >
                  <Body size={11.5} color={C.dim} style={{ lineHeight: 17 }}>
                    <Mono size={11.5} color={C.silver}>
                      {net.min} minimum
                    </Mono>
                    {" — anything under that may not credit."}
                  </Body>
                </View>
              </View>

              <View
                style={{
                  marginTop: 22,
                  paddingTop: 18,
                  borderTopWidth: 1,
                  borderTopColor: C.hairline,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 9,
                  }}
                >
                  <PulseDot />
                  <Body size={13} color={C.silver}>
                    Watching the chain for your deposit
                  </Body>
                </View>
                <Mono
                  size={10}
                  color={C.dim}
                  style={{
                    textAlign: "center",
                    marginTop: 8,
                    letterSpacing: 1.2,
                  }}
                >
                  {checkedAgo === null
                    ? "STANDING BY"
                    : `CHECKED ${checkedAgo}S AGO`}
                </Mono>
                <Body
                  size={11.5}
                  color={C.dim}
                  style={{ textAlign: "center", marginTop: 12, lineHeight: 18 }}
                >
                  It converts to naira and credits on arrival — usually inside a
                  minute. Leave if you like; it lands either way.
                </Body>

                <View style={{ marginTop: 18 }}>
                  <GhostButton
                    label={refreshed ? "Up to date" : "Refresh balance"}
                    onPress={refresh}
                  />
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
