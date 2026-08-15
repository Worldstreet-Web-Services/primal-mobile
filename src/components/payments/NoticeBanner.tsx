import React from "react";
import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
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
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderRadius: 16,
        backgroundColor: warning ? "rgba(246,165,165,0.07)" : C.raised,
        borderWidth: 1,
        borderColor: warning ? "rgba(246,165,165,0.34)" : C.hairline,
      }}
    >
      {icon ?? <AlertIcon size={18} color={accent} />}
      <Text
        style={{
          flex: 1,
          fontFamily: F.body,
          fontSize: 12.5,
          lineHeight: 18,
          color: accent,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
