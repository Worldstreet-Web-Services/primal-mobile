import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, Text } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { C, F } from "../theme/tokens";
import {
  Screen,
  PressableScale,
  PrimaryButton,
  PulseDot,
  Shine,
  Mono,
  Body,
  Display,
  Label,
} from "../components/ui";

// Design 3c: games space — own balance, claim banner, flagship Last Man card,
// then the floor's quieter rooms.
const flagshipStats = [
  { k: "POT", v: "$1,240" },
  { k: "CLOCK", v: "04:32", amber: true },
  { k: "STANDING", v: "@tobi" },
];

/** Rooms that aren't open yet. They recede — full surface, no dashed edge,
 *  a seal instead of a fake player count. */
const soonRooms = [
  { name: "Chess", note: "Rated tables, private stakes", glyph: "♞" },
  { name: "Checkers", note: "Short rounds, house rules", discs: true },
];

function Seal({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: C.hairline,
        backgroundColor: C.inset,
      }}
    >
      <Mono size={8.5} color={C.dim} style={{ letterSpacing: 1.6 }}>
        {label}
      </Mono>
    </View>
  );
}

function SoonRoom({
  name,
  note,
  glyph,
  discs,
}: {
  name: string;
  note: string;
  glyph?: string;
  discs?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 20,
        backgroundColor: C.raised,
        borderWidth: 1,
        borderColor: C.hairline,
        padding: 16,
        overflow: "hidden",
      }}
    >
      <Shine />
      {/* A ghost of the game's mark, low enough to read as material. */}
      {glyph ? (
        <Text
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -14,
            bottom: -30,
            fontSize: 104,
            lineHeight: 116,
            color: C.silver,
            opacity: 0.05,
          }}
        >
          {glyph}
        </Text>
      ) : null}
      {discs ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -26,
            bottom: -26,
            flexDirection: "row",
            opacity: 0.05,
          }}
        >
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: C.silver,
            }}
          />
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              marginLeft: -28,
              borderWidth: 6,
              borderColor: C.silver,
            }}
          />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {discs ? (
          <View style={{ flexDirection: "row" }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: C.silver,
                opacity: 0.55,
              }}
            />
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                marginLeft: -7,
                backgroundColor: C.inset,
                borderWidth: 1,
                borderColor: C.border,
              }}
            />
          </View>
        ) : (
          <Text style={{ fontSize: 20, lineHeight: 24, color: C.silver }}>
            {glyph}
          </Text>
        )}
        <Seal label="SOON" />
      </View>
      <Body size={14} semibold color={C.silver} style={{ marginTop: 24 }}>
        {name}
      </Body>
      <Body size={10.5} color={C.dim} style={{ marginTop: 4, lineHeight: 15 }}>
        {note}
      </Body>
    </View>
  );
}

export default function GamesSpaceScreen({
  onOpenGame,
  top = 0,
}: {
  onOpenGame?: (slug: string) => void;
  /** Head space for the floating nav header. */
  top?: number;
}) {
  // The screen's one motion moment: the flagship settles into place.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 480,
      delay: 90,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const openLastMan = () => onOpenGame && onOpenGame("last-man");

  return (
    <Screen top={top}>
      {/* Title and back live in the route's NavHeader now; the balance keeps
          its own line here. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: 10,
        }}
      >
        <Label style={{ letterSpacing: 2.2 }}>GAMES BALANCE</Label>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: F.monoSemibold, fontSize: 13, color: C.text }}>
          $85.00
        </Text>
      </View>
      <View
        style={{ height: 1, backgroundColor: C.hairline, marginTop: 12 }}
      />

      {/* Won money wears the up tone — it is yours already, not at stake. */}
      <View
        style={{
          marginTop: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "rgba(124,231,176,0.26)",
          backgroundColor: C.upBg,
          paddingVertical: 15,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flex: 1 }}>
          <Mono size={9.5} color={C.up} style={{ letterSpacing: 1.8, opacity: 0.75 }}>
            YOUR WINNINGS
          </Mono>
          <Text
            style={{
              fontFamily: F.monoSemibold,
              fontSize: 20,
              color: C.up,
              marginTop: 5,
            }}
          >
            $920.00
          </Text>
          <Body size={11} color={C.dim} style={{ marginTop: 4 }}>
            Round #62 settled your way. Claim to collect it.
          </Body>
        </View>
        <PressableScale scale={0.96}>
          <View
            accessibilityRole="button"
            accessibilityLabel="Claim winnings"
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(124,231,176,0.45)",
              backgroundColor: "rgba(124,231,176,0.12)",
              paddingVertical: 10,
              paddingHorizontal: 18,
            }}
          >
            <Text
              style={{
                fontFamily: F.monoSemibold,
                fontSize: 11.5,
                letterSpacing: 1.4,
                color: C.up,
              }}
            >
              CLAIM
            </Text>
          </View>
        </PressableScale>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: 26,
          marginBottom: 12,
        }}
      >
        <Label style={{ letterSpacing: 2.4 }}>THE FLOOR</Label>
        <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
      </View>

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
        <PressableScale onPress={openLastMan} scale={0.985}>
          <View
            style={{
              borderRadius: 26,
              backgroundColor: C.raised,
              borderWidth: 1,
              borderColor: C.border,
              padding: 20,
              overflow: "hidden",
            }}
          >
            <Shine />
            <Svg
              pointerEvents="none"
              width="100%"
              height="100%"
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            >
              <Defs>
                <RadialGradient id="floorLight" cx="78%" cy="4%" rx="70%" ry="60%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.09} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#floorLight)" />
            </Svg>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Mono size={9.5} color={C.sub} style={{ letterSpacing: 2 }}>
                FLAGSHIP · ROUND #63
              </Mono>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: C.hairline,
                  backgroundColor: C.inset,
                }}
              >
                <PulseDot color={C.live} size={5} />
                <Mono size={9.5} color={C.silver} style={{ letterSpacing: 1.6 }}>
                  LIVE
                </Mono>
              </View>
            </View>
            <Display size={28} style={{ marginTop: 14, lineHeight: 32 }}>
              {"The Last Man\nStanding"}
            </Display>
            <View
              style={{
                marginTop: 18,
                paddingTop: 14,
                flexDirection: "row",
                borderTopWidth: 1,
                borderTopColor: C.hairline,
              }}
            >
              {flagshipStats.map((s, i) => (
                <View
                  key={s.k}
                  style={{
                    flex: 1,
                    paddingLeft: i ? 14 : 0,
                    borderLeftWidth: i ? 1 : 0,
                    borderLeftColor: C.hairline,
                  }}
                >
                  <Mono size={9} color={C.dim} style={{ letterSpacing: 1.6 }}>
                    {s.k}
                  </Mono>
                  <Text
                    style={{
                      fontFamily: F.monoSemibold,
                      fontSize: 16,
                      marginTop: 6,
                      color: s.amber ? C.amber : C.text,
                    }}
                  >
                    {s.v}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 18 }}>
              <PrimaryButton
                label="Enter the round · $50"
                height={50}
                radius={16}
                uppercase={false}
                color={C.brand}
                onPress={openLastMan}
              />
            </View>
            <Body
              size={11}
              color={C.dim}
              style={{ marginTop: 12, lineHeight: 16.5 }}
            >
              Pay in, take the lead, reset the clock. Outlast the table and the
              pot is yours.
            </Body>
          </View>
        </PressableScale>
      </Animated.View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: 26,
          marginBottom: 12,
        }}
      >
        <Label style={{ letterSpacing: 2.4 }}>OPENING SOON</Label>
        <View style={{ flex: 1, height: 1, backgroundColor: C.hairline }} />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {soonRooms.map((r) => (
          <SoonRoom
            key={r.name}
            name={r.name}
            note={r.note}
            glyph={r.glyph}
            discs={r.discs}
          />
        ))}
      </View>

      <View style={{ marginTop: 26, alignItems: "center", gap: 10 }}>
        <View style={{ width: 32, height: 1, backgroundColor: C.hairline }} />
        <Mono
          size={9.5}
          color={C.dim}
          style={{ textAlign: "center", letterSpacing: 1.5, marginBottom: 8 }}
        >
          SETTLED ON-CHAIN · SIGNED WITH FACE ID
        </Mono>
      </View>
    </Screen>
  );
}
