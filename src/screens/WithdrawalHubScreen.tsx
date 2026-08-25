import { View } from "react-native";

import {
  BankGlyph,
  CryptoGlyph,
  MovementMethodPlate,
} from "@/components/MovementMethodPlate";
import { BackHeader, Body, Display, Label, Screen } from "@/components/ui";
import { GATEWAY_CAPABILITIES } from "@/lib/gateway/capabilities";
import { C } from "@/theme/tokens";

/** Ark-style withdrawal chooser over Primal's two independent money stores. */
export default function WithdrawalHubScreen({
  onBack,
  onBank,
}: {
  onBack?: () => void;
  onBank?: () => void;
}) {
  return (
    <Screen>
      <BackHeader title="Withdraw" onBack={onBack} />

      <View style={{ marginTop: 18 }}>
        <Display size={19} color={C.silver} style={{ lineHeight: 27 }}>
          Bank payouts are available now.{"\n"}Crypto needs a Gateway route.
        </Display>

        <Label style={{ marginTop: 26 }}>Where it goes</Label>
        <View style={{ marginTop: 12 }}>
          <MovementMethodPlate
            title="To a bank account"
            sub="Withdraw naira from your LinkPay fiat balance."
            detail="BANK VALIDATION · QUOTE · LINKPAY PAYOUT"
            glyph={<BankGlyph />}
            onPress={onBank}
          />
          <View style={{ marginTop: 12 }}>
            <MovementMethodPlate
              title="To an external wallet"
              sub="Waiting for a public Gateway withdrawal contract."
              detail="CRYPTO WITHDRAWAL · NOT EXPOSED BY API V0.1"
              glyph={<CryptoGlyph direction="out" />}
              disabled={!GATEWAY_CAPABILITIES.cryptoWithdrawals}
            />
          </View>
        </View>

        <Body size={11} color={C.dim} style={{ marginTop: 22, lineHeight: 17 }}>
          Bank payouts are live through LinkPay. Crypto withdrawals and
          conversions remain unavailable until the Gateway exposes them.
        </Body>
      </View>
    </Screen>
  );
}
