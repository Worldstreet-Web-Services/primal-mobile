import { type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Text, View } from "react-native";

import { C } from "../../theme/tokens";
import { RingDecor } from "../icons";
import { AmountText, Display, PressableScale, Shine } from "../ui";

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
        {/* Olive-cast slab, relit for the charcoal ground (2026-08-16). The old
            stops were a near-black barely above #0A0B0D; on #232323 they read
            as a hole cut in the home screen. Same two moves as before — a step
            up from the ground, with a faint brand-green bias, rolling back down
            to the ground at the far corner — just measured from the new one. */}
        <LinearGradient
          colors={["#2F3524", "#262821"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: C.border,
            overflow: "hidden",
            paddingHorizontal: 18,
            paddingVertical: 20,
          }}
        >
          <Shine />
          <View pointerEvents="none" className="absolute left-[0px] top-[40px]">
            <RingDecor size={290} color={C.brandSoft} opacity={0.2} />
          </View>

          {/* Greeting is the eyebrow; the NAME and the BALANCE carry the
              card. The old inverse hierarchy (32px greeting, 18px name)
              wrapped "Good Morning," onto two lines and doubled the card's
              height. */}
          <View style={{ maxWidth: "64%" }}>
            <Text
              numberOfLines={1}
              className="font-mono text-[11px] tracking-[1.8px] text-sub"
            >
              {`${greeting},`.toUpperCase()}
            </Text>
            <Display className="text-[27px] leading-[28.35px] mt-[6px]">
              {name}
            </Display>

            {balance ? (
              <View className="mt-[18px]">
                {hidden ? (
                  <Display className="text-[38px] leading-[39.9px]">
                    {MASK}
                  </Display>
                ) : (
                  <AmountText value={balance} size={38} />
                )}
                <Text className="font-mono text-[11px] tracking-[1.8px] text-dim mt-[5px]">
                  {balanceLabel.toUpperCase()}
                </Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* Art sits low-right so it never crowds the name; overhang is capped
            at the screen gutter — the ScrollView clips at its own edges. */}
        {/* <ArtSlot
          source={artwork}
          size={148}
          style={{ position: "absolute", right: -10, bottom: -4 }}
        /> */}
      </View>
    </PressableScale>
  );
}
