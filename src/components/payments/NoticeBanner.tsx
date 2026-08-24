import React from "react";
import { Text, View } from "react-native";

import { C } from "../../theme/tokens";
import { AlertIcon } from "../icons";

export type NoticeTone = "warning" | "info";

/**
 * Standing warning above an irreversible action. Tinted rather than filled, so
 * it reads as a caution the user must clear — not as an error that already
 * happened.
 */
export function NoticeBanner({
  message,
  tone = "warning",
  icon,
}: {
  message: string;
  tone?: NoticeTone;
  icon?: React.ReactNode;
}) {
  const warning = tone === "warning";
  const accent = warning ? C.down : C.silver;

  return (
    <View
      accessibilityRole="alert"
      className="flex-row gap-[12px] p-[16px] rounded-[16px] border"
      style={{
        backgroundColor: warning ? "rgba(246,165,165,0.07)" : C.raised,
        borderColor: warning ? "rgba(246,165,165,0.34)" : C.hairline,
      }}
    >
      {icon ?? <AlertIcon size={18} color={accent} />}
      <Text
        className="flex-1 font-body text-[12.5px] leading-[18px]"
        style={{
          color: accent,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
