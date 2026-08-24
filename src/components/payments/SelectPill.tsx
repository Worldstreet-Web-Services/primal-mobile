import { type ImageSource } from "expo-image";
import { Text, View } from "react-native";

import { C } from "../../theme/tokens";
import { ChevronDownIcon } from "../icons";
import { PILL, PressableScale } from "../ui";
import { TokenBadge } from "./TokenBadge";
import { cn } from "@/lib/cn";

/**
 * Badge + label in a pill, for picking an asset or a network. `selected` rings
 * it in the brand color; `chevron` marks the ones that open a list, so a locked
 * choice and an openable one are told apart at a glance.
 */
export function SelectPill({
  label,
  symbol,
  artwork,
  badgeColor,
  selected = false,
  chevron = false,
  onPress,
  style,
}: {
  label: string;
  /** Feeds the placeholder badge's initial when no artwork exists yet. */
  symbol?: string;
  artwork?: ImageSource | number;
  badgeColor?: string;
  selected?: boolean;
  chevron?: boolean;
  onPress?: () => void;
  style?: object;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scale={0.97}
      style={style}
      accessibilityLabel={label}
    >
      <View
        className={cn(
          "flex-row items-center gap-[10px] h-[52px] px-[12px] bg-canvas-raised border",
          selected ? "border-brand" : "border-rule",
        )}
        style={{
          borderRadius: PILL,
        }}
      >
        <TokenBadge
          symbol={symbol ?? label}
          artwork={artwork}
          color={badgeColor}
        />
        <Text
          numberOfLines={1}
          className="flex-1 font-body-semibold text-[14.5px] text-text"
        >
          {label}
        </Text>
        {chevron ? <ChevronDownIcon size={16} color={C.silver} /> : null}
      </View>
    </PressableScale>
  );
}
