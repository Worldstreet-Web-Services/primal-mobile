import React from "react";
import { Text, View } from "react-native";

import { cn } from "../../lib/cn";
import { C, useTokens, withAlpha } from "../../theme/tokens";
import { AlertIcon } from "../icons";

export type NoticeTone = "warning" | "info" | "positive";

/**
 * Standing note beside a consequential action. Tinted rather than filled, so it
 * reads as something the user must take in — not as an error that already
 * happened.
 *
 * `positive` is the same shape turned the other way: a reassurance sitting
 * under the thing it reassures about ("you can still get out of this"), so it
 * takes the brand hairline rather than the rose one.
 */
export function NoticeBanner({
  message,
  tone = "warning",
  icon,
  className,
}: {
  message: string;
  tone?: NoticeTone;
  icon?: React.ReactNode;
  className?: string;
}) {
  const t = useTokens();

  // Ink and stroke move together — a banner is one object, not a box with a
  // label in it. Only `info` splits them, because chrome has no tinted face.
  const skin = {
    warning: {
      ink: t.down,
      fill: withAlpha(C.down, 0.07),
      stroke: withAlpha(C.down, 0.34),
    },
    info: { ink: t.silver, fill: t.raised, stroke: t.hairline },
    positive: { ink: t.brandSoft, fill: t.brandGlow, stroke: t.brandGlow },
  }[tone];

  return (
    <View
      accessibilityRole="alert"
      className={cn(
        "flex-row gap-[12px] p-[16px] rounded-[16px] border",
        className,
      )}
      style={{
        backgroundColor: skin.fill,
        borderColor: skin.stroke,
      }}
    >
      {icon ?? <AlertIcon size={18} color={skin.ink} />}
      <Text
        className="flex-1 font-body text-[12.5px] leading-[18px]"
        style={{
          color: skin.ink,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
