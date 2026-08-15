import React from "react";
import { Text, View } from "react-native";

import { C, F } from "../theme/tokens";
import { ArrowRight } from "./icons";
import { PressableScale } from "./ui";

export interface Option {
  key: string;
  title: string;
  /** One line on what picking this actually does. */
  sub?: string;
  icon?: React.ReactNode;
}

/**
 * A full-width choice: icon tile, title over a sub line, arrow at the end.
 * `selected` fills it with the brand and flips the type to ink — used for the
 * recommended route in a list, or the one the user has landed on.
 *
 * The icon tile stays dark in both states, so a monochrome glyph reads the
 * same whichever row it sits in.
 */
export function OptionRow({
  option,
  selected = false,
  onPress,
  height = 74,
}: {
  option: Option;
  selected?: boolean;
  onPress?: (key: string) => void;
  height?: number;
}) {
  const ink = selected ? C.brandInk : C.text;

  return (
    <PressableScale
      onPress={() => onPress?.(option.key)}
      scale={0.98}
      accessibilityLabel={
        option.sub ? `${option.title}. ${option.sub}` : option.title
      }
    >
      <View
        style={{
          minHeight: height,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingHorizontal: 14,
          paddingVertical: 14,
          borderRadius: 20,
          backgroundColor: selected ? C.brand : C.raised,
          borderWidth: 1,
          borderColor: selected ? C.brand : C.hairline,
        }}
      >
        {option.icon ? (
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: selected ? C.ink : C.inset,
            }}
          >
            {option.icon}
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: F.displayBold,
              fontSize: 16,
              letterSpacing: 0.1,
              color: ink,
            }}
          >
            {option.title}
          </Text>
          {option.sub ? (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: F.body,
                fontSize: 12,
                marginTop: 4,
                // Ink at reduced weight rather than a grey, so the sub line
                // stays legible on the brand fill.
                color: selected ? "rgba(10,20,5,0.68)" : C.sub,
              }}
            >
              {option.sub}
            </Text>
          ) : null}
        </View>

        <ArrowRight
          size={22}
          color={selected ? C.brandInk : C.brand}
          strokeWidth={4}
        />
      </View>
    </PressableScale>
  );
}

/** Stack of options with the section's own spacing. */
export function OptionList({
  options,
  selectedKey,
  onSelect,
  gap = 12,
}: {
  options: Option[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
  gap?: number;
}) {
  return (
    <View style={{ gap }}>
      {options.map((option) => (
        <OptionRow
          key={option.key}
          option={option}
          selected={option.key === selectedKey}
          onPress={onSelect}
        />
      ))}
    </View>
  );
}
