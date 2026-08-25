import { View } from "react-native";
import { C } from "../theme/tokens";
import {
  Screen,
  BackHeader,
  GhostButton,
  Label,
  Body,
  Display,
} from "../components/ui";
import {
  BankGlyph,
  CryptoGlyph,
  MovementMethodPlate,
} from "../components/MovementMethodPlate";
import { GATEWAY_CAPABILITIES } from "../lib/gateway/capabilities";

// One Ark-style entry point that also exposes the current backend boundary.
// Bank transfers credit the LinkPay naira ledger; crypto remains disabled until
// the public Gateway owns a documented deposit-address lifecycle.

export default function FundScreen({
  onBack,
  onBankTransfer,
  onOpenReceive,
}: {
  onBack?: () => void;
  /** Bank transfer is its own screen — the real account, then the deposit watch. */
  onBankTransfer?: () => void;
  onOpenReceive?: () => void;
}) {
  return (
    <Screen>
      <BackHeader title="Add funds" onBack={onBack} />

      <View style={{ marginTop: 18 }}>
        <Display size={19} color={C.silver} style={{ lineHeight: 27 }}>
          Bank funding is available now.{"\n"}Crypto needs a Gateway route.
        </Display>

        <Label style={{ marginTop: 26 }}>How money gets in</Label>
        <View style={{ marginTop: 12 }}>
          {/* The sub-line says PERMANENT because that is what /fund-bank hands
              over. The earlier "a one-off account, issued to you for this
              transfer" promised an expiring number LinkPay does not issue — the
              next screen would have contradicted it on arrival. */}
          <MovementMethodPlate
            title="Bank transfer"
            sub="Send naira from any Nigerian bank into your fiat balance."
            detail="LINKPAY · PERMANENT ACCOUNT · NAIRA BALANCE"
            glyph={<BankGlyph />}
            onPress={onBankTransfer}
          />
          <View style={{ marginTop: 12 }}>
            <MovementMethodPlate
              title="Crypto deposit"
              sub="Waiting for a public Gateway deposit-address contract."
              detail="CRYPTO DEPOSIT · NOT EXPOSED BY API V0.1"
              glyph={<CryptoGlyph direction="in" />}
              disabled={!GATEWAY_CAPABILITIES.cryptoDeposits}
            />
          </View>
        </View>

        <View
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTopWidth: 1,
            borderTopColor: C.hairline,
          }}
        >
          <GhostButton label="Show my account details" onPress={onOpenReceive} />
          <Body
            size={11}
            color={C.dim}
            style={{ textAlign: "center", marginTop: 14, lineHeight: 17 }}
          >
            Your account number, ready to hand to someone else.
          </Body>
        </View>

        <Body
          size={11}
          color={C.dim}
          style={{ marginTop: 22, lineHeight: 17 }}
        >
          Bank funding is live through LinkPay. Crypto funding and conversion
          will appear only when the Gateway can quote and settle them end to
          end.
        </Body>
      </View>
    </Screen>
  );
}
