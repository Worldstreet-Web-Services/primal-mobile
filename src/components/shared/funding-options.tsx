import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

import { Option, OptionRow } from "@/components/OptionRow";
import { C, F } from "@/theme/tokens";
import { BankIcon, WalletIcon } from "../icons";
import { CryptoCheckout, LocalBankCheckout } from "../payments";
import { Sheet } from "../Sheet";

export type FundingKey = "decentralized" | "local";

const FUNDING_OPTIONS: Option[] = [
  {
    key: "decentralized",
    title: "Decentralized Wallet",
    sub: "Direct transfer from your smart vault",
    icon: <WalletIcon size={22} color={C.text} />,
  },
  {
    key: "local",
    title: "Local Bank Network",
    sub: "Instant card deposit or bank wire",
    icon: <BankIcon size={22} color={C.text} />,
  },
];

const FundingOptions = ({
  options = FUNDING_OPTIONS,
  selectedKey = "decentralized",
  delay = 0,
  sheet = true,
  onConfirm,
  onClose,
}: {
  options?: Option[];
  /** Which row carries the brand fill as the recommended route. */
  selectedKey?: string;
  /** Holds the entry animation, to fall in behind whatever lands first. */
  delay?: number;
  /** Own the checkout's sheet. Off when a host sheet already wraps this. */
  sheet?: boolean;
  onConfirm?: (key: string) => void;
  /** Only reached with `sheet={false}` — the checkout's × asking the host out. */
  onClose?: () => void;
}) => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const copy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = Animated.timing(copy, {
      toValue: 1,
      duration: 900,
      delay,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [copy, delay]);

  const step = (i: number) => {
    const start = i * 0.11;
    const range = [start, Math.min(start + 0.42, 1)];
    return {
      opacity: copy.interpolate({
        inputRange: range,
        outputRange: [0, 1],
        extrapolate: "clamp" as const,
      }),
      transform: [
        {
          translateY: copy.interpolate({
            inputRange: range,
            outputRange: [22, 0],
            extrapolate: "clamp" as const,
          }),
        },
      ],
    };
  };

  /**
   * The picked option's checkout. `back` is what its back arrow does — dismiss
   * the sheet it owns, or return to the list it replaced.
   */
  const checkout = (key: string, back: () => void, close: () => void) => {
    // Leave the checkout before handing off: a host that navigates on confirm
    // would otherwise land on the next screen with this still over it.
    const confirm = (picked: FundingKey) => {
      back();
      onConfirm?.(picked);
    };

    return key === "local" ? (
      <LocalBankCheckout
        onBack={back}
        onClose={close}
        onConfirm={() => confirm("local")}
      />
    ) : (
      <CryptoCheckout
        onBack={back}
        onClose={close}
        onConfirm={() => confirm("decentralized")}
      />
    );
  };

  // In-place step: the host's sheet is already open, so the checkout takes over
  // the same surface. Back returns to the list; × asks the host to close.
  if (!sheet && openKey !== null) {
    return checkout(
      openKey,
      () => setOpenKey(null),
      () => {
        setOpenKey(null);
        onClose?.();
      },
    );
  }

  return (
    <View>
      <Animated.View style={step(0)}>
        <Text
          style={{
            fontFamily: F.displayBold,
            fontSize: 17,
            color: C.text,
            marginBottom: 14,
          }}
        >
          Funding Options
        </Text>
      </Animated.View>

      <View style={{ gap: 12 }}>
        {options.map((option, i) => (
          <Animated.View key={option.key} style={step(1 + i)}>
            <OptionRow
              option={option}
              selected={option.key === selectedKey}
              onPress={setOpenKey}
            />
          </Animated.View>
        ))}
      </View>

      {/* The one draggable drawer in the flow — it was summoned, so it can be
          dismissed. The layout's own drawer stays put. */}
      {sheet ? (
        <Sheet
          visible={openKey !== null}
          onClose={() => setOpenKey(null)}
          draggable
        >
          {(close) => checkout(openKey ?? "decentralized", close, close)}
        </Sheet>
      ) : null}
    </View>
  );
};

export default FundingOptions;
