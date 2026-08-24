import React from "react";
import { Text, View } from "react-native";

import { C } from "../theme/tokens";
import { ArrowRight } from "./icons";
import { PressableScale } from "./ui";
import { cn } from "@/lib/cn";

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
        className={cn(
          "flex-row items-center gap-[14px] px-[14px] py-[14px] rounded-[20px] border",
          selected ? "bg-brand" : "bg-canvas-raised",
          selected ? "border-brand" : "border-rule",
        )}
        style={{
          minHeight: height,
        }}
      >
        {option.icon ? (
          <View
            className={cn(
              "w-[46px] h-[46px] rounded-[15px] items-center justify-center",
              selected ? "bg-ink" : "bg-canvas-inset",
            )}
          >
            {option.icon}
          </View>
        ) : null}

        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="font-display-bold text-[16px] tracking-[0.1px]"
            style={{
              color: ink,
            }}
          >
            {option.title}
          </Text>
          {option.sub ? (
            <Text
              numberOfLines={1}
              className="font-body text-[12px] mt-[4px]"
              style={{
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
