import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { C, F } from "../../theme/tokens";
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
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        height: 58,
        paddingLeft: 16,
        paddingRight: 10,
        borderRadius: 14,
        backgroundColor: C.raised,
        borderWidth: 1,
        borderColor: C.hairline,
      }}
    >
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flex: 1,
          fontFamily: F.mono,
          fontSize: 13.5,
          color: C.text,
        }}
      >
        {address}
      </Text>

      <Pressable
        onPress={copy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={copied ? "Address copied" : "Copy deposit address"}
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: C.inset,
        }}
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
