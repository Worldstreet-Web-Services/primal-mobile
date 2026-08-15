import { Text, View } from "react-native";

import { C, F } from "../../theme/tokens";

/**
 * What is being paid for, and what it costs. The fiat figure leads and the
 * token amount sits under it — the charge is denominated in one and settled in
 * the other, and conflating them is how people overpay.
 */
export function PlanCard({
  plan,
  name,
  amount,
  amountSub,
}: {
  /** Product line above the name, e.g. "PRIMAL PREMIUM". */
  plan: string;
  name: string;
  amount: string;
  amountSub?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 18,
        borderRadius: 18,
        backgroundColor: C.raised,
        borderWidth: 1,
        borderColor: C.hairline,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: F.mono,
            fontSize: 10.5,
            letterSpacing: 1.5,
            color: C.silver,
          }}
        >
          {plan.toUpperCase()}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: F.displayBold,
            fontSize: 19,
            color: C.text,
            marginTop: 7,
          }}
        >
          {name}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            fontFamily: F.displayBold,
            fontSize: 24,
            color: C.brand,
          }}
        >
          {amount}
        </Text>
        {amountSub ? (
          <Text
            style={{
              fontFamily: F.mono,
              fontSize: 11.5,
              color: C.sub,
              marginTop: 5,
            }}
          >
            {amountSub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
