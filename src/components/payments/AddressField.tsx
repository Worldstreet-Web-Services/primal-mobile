import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { C } from "../../theme/tokens";
import { CheckIcon, CopyIcon } from "../icons";

/** How long the copied state holds before reverting. */
const CONFIRM_MS = 1600;

/**
 * A deposit address with a copy affordance. The address is never wrapped — a
 * broken hash invites a misread — so it truncates in the middle, keeping the
 * head and tail that people actually check against their wallet.
 */
export function AddressField({
  address,
  onCopy,
}: {
  address: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(address);
    onCopy?.();
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), CONFIRM_MS);
  };

  return (
    <View className="flex-row items-center gap-[10px] h-[58px] pl-[16px] pr-[10px] rounded-[14px] bg-canvas-raised border border-rule">
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className="flex-1 font-mono text-[13.5px] text-text"
      >
        {address}
      </Text>

      <Pressable
        onPress={copy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={copied ? "Address copied" : "Copy deposit address"}
        className="w-[38px] h-[38px] rounded-[11px] items-center justify-center bg-canvas-inset"
      >
        {copied ? (
          <CheckIcon size={17} color={C.brand} />
        ) : (
          <CopyIcon size={17} color={C.silver} />
        )}
      </Pressable>
    </View>
  );
}
