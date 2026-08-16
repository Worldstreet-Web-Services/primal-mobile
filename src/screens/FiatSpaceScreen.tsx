import React from "react";
import { View } from "react-native";
import { C, F } from "../theme/tokens";
import {
  Screen,
  MetallicButton,
  GhostButton,
  Label,
  Mono,
  Body,
  Display,
  TxRow,
  Card,
} from "../components/ui";
import { fiatActivity, user } from "../data/mock";

// Design 2c: fiat space — its own balance, actions, fiat-only activity.
export default function FiatSpaceScreen({
  onAdd,
  onSend,
  onRemit,
  top = 0,
}: {
  onAdd?: () => void;
  onSend?: () => void;
  onRemit?: () => void;
  /** Head space for the floating nav header. */
  top?: number;
}) {
  return (
    <Screen top={top}>
      {/* Title and back live in the route's NavHeader now. */}
      <View style={{ marginTop: 26 }}>
        <Body size={11.5} color={C.dim}>
          Available balance
        </Body>
        <Display size={46} style={{ marginTop: 6 }}>
          ₦482,650
          <Display size={26} color={C.dim}>
            .00
          </Display>
        </Display>
        <Mono size={12} color={C.sub} style={{ marginTop: 8 }}>
          ≈ $312.40 USD
        </Mono>
        <Card
          style={{
            marginTop: 14,
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            paddingVertical: 9,
            paddingHorizontal: 13,
            borderRadius: 12,
          }}
        >
          <Mono size={12.5}>
            {user.va} · {user.bank}
          </Mono>
          <Body size={10} color={C.accent} semibold>
            Copy
          </Body>
        </Card>
      </View>
      <View style={{ marginTop: 18, flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <MetallicButton
            label="Add"
            height={46}
            radius={14}
            size={13}
            onPress={onAdd}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GhostButton label="Send" onPress={onSend} />
        </View>
        {/* Cross-border is out of this version (2026-08-16). The prop and the
            screen stay — only the way in is closed — so putting it back is
            re-adding this button, not rebuilding the corridor flow. */}
        {onRemit ? (
          <View style={{ flex: 1 }}>
            <GhostButton label="Remit" onPress={onRemit} />
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 20 }}>
        <Label>Fiat activity</Label>
        {fiatActivity.map((t, i) => (
          <TxRow key={i} {...t} last={i === fiatActivity.length - 1} />
        ))}
      </View>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 16 }}
      >
        Balances shown in kobo-true minor units · statements match to the kobo
      </Body>
      <Body
        size={11}
        color={C.dim}
        style={{ textAlign: "center", marginTop: 8 }}
      >
        Deposits, transfers and your account number — powered by LinkPay
      </Body>
    </Screen>
  );
}
