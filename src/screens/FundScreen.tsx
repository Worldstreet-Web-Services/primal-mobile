import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { C, F } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  MetallicButton,
  GhostButton,
  Card,
  Label,
  Mono,
  Body,
  PulseDot,
} from "../components/ui";

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

const truncate = (addr: string) => addr.slice(0, 10) + "…" + addr.slice(-6);

const netsFor = (t: Tok) => NETWORKS.filter((n) => t.nets.includes(n.key));

function TokenBadge({ sym, size = 36 }: { sym: string; size?: number }) {
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
      }}
    >
      <Mono size={size * 0.28} color={C.silver}>
        {sym.slice(0, 3)}
      </Mono>
    </View>
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
        marginTop: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <TokenBadge sym={sym} size={30} />
      <View style={{ flex: 1 }}>{label}</View>
      <Pressable onPress={onChange} hitSlop={8}>
        <Mono size={11} color={C.brandSoft}>
          CHANGE
        </Mono>
      </Pressable>
    </Card>
  );
}

function MethodRow({
  title,
  sub,
  onPress,
  last,
}: {
  title: string;
  sub: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: C.hairline,
      }}
    >
      <View style={{ flex: 1 }}>
        <Body size={13.5} semibold>
          {title}
        </Body>
        <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>
          {sub}
        </Body>
      </View>
      <Text style={{ color: C.dim, fontSize: 18, fontFamily: F.body }}>›</Text>
    </Pressable>
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
  const [copied, setCopied] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    if (step !== "address") return;
    setReady(false);
    setCopied(false);
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, [step, net]);

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

  const copyAddr = async () => {
    if (!net) return;
    try {
      await Clipboard.setStringAsync(net.addr);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const refresh = () => {
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 1600);
  };

  const title =
    step === "method"
      ? "Fund wallet"
      : step === "token"
        ? "What are you sending?"
        : step === "network"
          ? `Send ${tok ? tok.sym : ""} from…`
          : `Fund with ${tok ? tok.sym : ""}`;

  return (
    <Screen>
      <BackHeader title={title} onBack={back} />

      {step === "method" ? (
        <View style={{ marginTop: 20 }}>
          <Label>Choose a method</Label>
          <Card style={{ marginTop: 10, paddingVertical: 4 }}>
            <MethodRow
              title="Bank transfer"
              sub="Free · one-off account · usually under 10s"
              onPress={onBankTransfer}
            />
            <MethodRow
              title="Crypto deposit"
              sub="Any chain · auto-converts to ₦"
              onPress={() => setStep("token")}
              last
            />
          </Card>
          <View style={{ marginTop: 16 }}>
            <GhostButton label="Receive QR & details" onPress={onOpenReceive} />
          </View>
          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 14 }}
          >
            Every method lands as Paradigm balance — spend it anywhere in the
            app
          </Body>
        </View>
      ) : null}

      {step === "token" ? (
        <View style={{ marginTop: 8 }}>
          <Body size={12.5} color={C.sub}>
            Whatever you send arrives as ₦ in your balance.
          </Body>

          <Label style={{ marginTop: 18 }}>Popular</Label>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10, marginHorizontal: -20 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
          >
            {SPOTLIGHT.map((p) => {
              const n = NETWORKS.find((x) => x.key === p.net);
              if (!n) return null;
              return (
                <Pressable
                  key={p.sym + p.net}
                  onPress={() => pickPair(p.sym, p.net)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: C.card,
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 14,
                    paddingVertical: 9,
                    paddingLeft: 10,
                    paddingRight: 14,
                  }}
                >
                  <TokenBadge sym={p.sym} size={30} />
                  <View>
                    <Body size={12.5} semibold>
                      {p.sym}
                    </Body>
                    <Body size={10.5} color={C.dim}>
                      {n.label}
                    </Body>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tokens"
            placeholderTextColor={C.dim}
            style={{
              marginTop: 14,
              backgroundColor: C.key,
              borderWidth: 1,
              borderColor: C.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 11,
              color: C.text,
              fontFamily: F.body,
              fontSize: 14,
            }}
          />

          <Card style={{ marginTop: 12, paddingVertical: 4 }}>
            {visible.map((t, i) => (
              <Pressable
                key={t.sym}
                onPress={() => {
                  setTok(t);
                  setStep("network");
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: i === visible.length - 1 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <TokenBadge sym={t.sym} />
                <View style={{ flex: 1 }}>
                  <Body size={13.5} semibold>
                    {t.sym}
                  </Body>
                  <Body size={11.5} color={C.dim} style={{ marginTop: 2 }}>
                    {t.name}
                  </Body>
                </View>
                <Body size={11} color={C.dim}>
                  {t.nets.length} {t.nets.length === 1 ? "network" : "networks"}
                </Body>
                <Text style={{ color: C.dim, fontSize: 18, fontFamily: F.body }}>
                  ›
                </Text>
              </Pressable>
            ))}
            {visible.length === 0 ? (
              <Body
                size={12}
                color={C.dim}
                style={{ textAlign: "center", paddingVertical: 18 }}
              >
                No tokens match your search.
              </Body>
            ) : null}
          </Card>

          {!q && !showAll && hidden > 0 ? (
            <Pressable
              onPress={() => setShowAll(true)}
              style={{
                marginTop: 12,
                alignItems: "center",
                paddingVertical: 12,
                borderRadius: 99,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: C.borderStrong,
              }}
            >
              <Body size={12} color={C.sub} semibold>
                More tokens (+{hidden})
              </Body>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {step === "network" && tok ? (
        <View style={{ marginTop: 8 }}>
          <Body size={12.5} color={C.sub}>
            Pick the network you're sending on.
          </Body>

          <SelectedRow
            sym={tok.sym}
            label={
              <Body size={13.5} semibold>
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
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 13,
                  borderBottomWidth: i === arr.length - 1 ? 0 : 1,
                  borderBottomColor: C.hairline,
                }}
              >
                <Body size={13.5} semibold style={{ flex: 1 }}>
                  {n.label}
                </Body>
                <Body size={11} color={C.dim}>
                  Min ≈ {n.min}
                </Body>
                <Text style={{ color: C.dim, fontSize: 18, fontFamily: F.body }}>
                  ›
                </Text>
              </Pressable>
            ))}
            {netsFor(tok).length === 0 ? (
              <Body
                size={12}
                color={C.dim}
                style={{ textAlign: "center", paddingVertical: 18 }}
              >
                No supported networks for {tok.sym} right now.
              </Body>
            ) : null}
          </Card>
        </View>
      ) : null}

      {step === "address" && tok && net ? (
        <View style={{ marginTop: 8 }}>
          <SelectedRow
            sym={tok.sym}
            label={
              <Body size={13.5} semibold>
                {tok.sym}
                <Body size={13.5} color={C.dim}>
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
            <Body
              size={12.5}
              color={C.dim}
              style={{ textAlign: "center", marginTop: 36 }}
            >
              Creating your deposit address…
            </Body>
          ) : (
            <View>
              <View
                style={{
                  width: 150,
                  height: 150,
                  borderRadius: 16,
                  alignSelf: "center",
                  marginTop: 20,
                  backgroundColor: C.key,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "rgba(199,204,209,0.3)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mono size={10} color={C.dim}>
                  QR · {tok.sym} on {net.label}
                </Mono>
              </View>

              <Pressable
                onPress={copyAddr}
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.border,
                  borderRadius: 14,
                  paddingVertical: 13,
                }}
              >
                <Mono
                  size={13}
                  color={C.text}
                  style={{ fontFamily: F.monoSemibold }}
                >
                  {truncate(net.addr)}
                </Mono>
                <Mono size={10} color={copied ? C.up : C.dim}>
                  {copied ? "✓ COPIED" : "COPY"}
                </Mono>
              </Pressable>

              <View
                style={{
                  marginTop: 14,
                  backgroundColor: C.brandGlow,
                  borderWidth: 1,
                  borderColor: "rgba(221,179,90,0.35)",
                  borderRadius: 14,
                  padding: 13,
                }}
              >
                <Body size={12} color={C.brandSoft} style={{ lineHeight: 17.5 }}>
                  Send only {tok.sym} on {net.label} to this address — anything
                  else may be lost.
                </Body>
              </View>
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: "rgba(245,184,61,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(245,184,61,0.35)",
                  borderRadius: 14,
                  padding: 13,
                }}
              >
                <Body size={12} color={C.amber} style={{ lineHeight: 17.5 }}>
                  Minimum deposit ≈ {net.min}. Smaller amounts may not be
                  credited.
                </Body>
              </View>

              <View
                style={{
                  marginTop: 14,
                  alignSelf: "center",
                  backgroundColor: C.upBg,
                  borderWidth: 1,
                  borderColor: "rgba(124,231,176,0.35)",
                  borderRadius: 99,
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                }}
              >
                <Body size={11} color={C.up} semibold>
                  ↓ Auto-converts to your ₦ balance
                </Body>
              </View>

              <View
                style={{
                  marginTop: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <PulseDot />
                <Body size={12.5} color={C.sub}>
                  Waiting for your deposit…
                </Body>
              </View>
              <Body
                size={11}
                color={C.dim}
                style={{ textAlign: "center", marginTop: 10, lineHeight: 17 }}
              >
                Your balance credits automatically once the transfer confirms —
                usually within a minute. You can leave this screen; it lands
                either way.
              </Body>

              <View style={{ marginTop: 16 }}>
                <GhostButton
                  label={refreshed ? "Up to date ✓" : "Refresh balance"}
                  onPress={refresh}
                />
              </View>
            </View>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
