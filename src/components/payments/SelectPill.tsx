import { type ImageSource } from "expo-image";
import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
import { ChevronDownIcon } from "../icons";
import { PILL, PressableScale } from "../ui";
import { TokenBadge } from "./TokenBadge";

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
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          height: 52,
          paddingHorizontal: 12,
          borderRadius: PILL,
          backgroundColor: C.raised,
          borderWidth: 1,
          borderColor: selected ? C.brand : C.hairline,
        }}
      >
        <TokenBadge
          symbol={symbol ?? label}
          artwork={artwork}
          color={badgeColor}
        />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: F.bodySemibold,
            fontSize: 14.5,
            color: C.text,
          }}
        >
          {label}
        </Text>
        {chevron ? <ChevronDownIcon size={16} color={C.silver} /> : null}
      </View>
    </PressableScale>
  );
}
