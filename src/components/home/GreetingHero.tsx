import { type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { RingDecor } from "../icons";
import { AmountText, Display, PressableScale, Shine } from "../ui";
import { ArtSlot } from "./ArtSlot";

/** What replaces the figure when it's hidden. */
const MASK = "••••••";

/**
 * The greeting slab: who you are, then what you're worth across the whole
 * ecosystem. Tapping the card hides the figure — shoulder-surfing is the
 * everyday threat on a balance this prominent.
 *
 * Visibility is uncontrolled by default; pass `balanceHidden` with
 * `onToggleBalance` to hoist it (e.g. to persist the preference app-wide).
 *
 * The artwork deliberately breaks the card's bounds, so the card must not
 * clip — see the `overflow` note below.
 */
export function GreetingHero({
  greeting,
  name,
  balance,
  balanceLabel = "Total portfolio",
  balanceHidden,
  onToggleBalance,
  artwork,
  onPress,
  height = 180,
}: {
  greeting: string;
  name: string;
  /** Preformatted total across every space. Omit to keep the card ambient. */
  balance?: string;
  balanceLabel?: string;
  /** Controlled visibility. Leave unset to let the card own it. */
  balanceHidden?: boolean;
  onToggleBalance?: (hidden: boolean) => void;
  artwork?: ImageSource | number;
  /** Fires alongside the toggle, for callers that want the tap too. */
  onPress?: () => void;
  height?: number;
}) {
  const [internalHidden, setInternalHidden] = useState(false);
  const controlled = balanceHidden !== undefined;
  const hidden = controlled ? balanceHidden : internalHidden;

  const handlePress = () => {
    const next = !hidden;
    if (!controlled) setInternalHidden(next);
    onToggleBalance?.(next);
    onPress?.();
  };

  return (
    <PressableScale
      onPress={handlePress}
      scale={0.985}
      accessibilityLabel={
        balance
          ? hidden
            ? "Show total portfolio"
            : "Hide total portfolio"
          : undefined
      }
    >
      {/* Plain, un-rounded wrapper. The artwork hangs off the card as a
          sibling below — a rounded view masks its own children, so anything
          meant to break the frame cannot live inside it. */}
      <View>
        <LinearGradient
          colors={["#141A0E", "#0D0F0C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: C.border,
            overflow: "hidden",
            justifyContent: "center",
            paddingHorizontal: 12,
          }}
        >
          <Shine />
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, top: 40 }}
          >
            <RingDecor size={height * 1.6} color={C.leaf} opacity={0.2} />
          </View>

          <View style={{ maxWidth: "70%" }}>
            <Display size={32}>{greeting},</Display>
            <Display size={18} color={C.silver} style={{ marginTop: 8 }}>
              {name}
            </Display>

            {balance ? (
              <View style={{ marginTop: 22 }}>
                {hidden ? (
                  <Display size={36}>{MASK}</Display>
                ) : (
                  <AmountText value={balance} size={36} />
                )}
                <Text
                  style={{
                    fontFamily: F.mono,
                    fontSize: 11,
                    letterSpacing: 1.8,
                    color: C.dim,
                    marginTop: 4,
                  }}
                >
                  {balanceLabel.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* Overhang is capped at the screen gutter — the ScrollView still
            clips at its own edges, so pushing further just cuts the art. */}
        <ArtSlot
          source={artwork}
          size={180}
          style={{ position: "absolute", right: -16, top: -6 }}
        />
      </View>
    </PressableScale>
  );
}
