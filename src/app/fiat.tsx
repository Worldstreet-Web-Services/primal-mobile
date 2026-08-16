import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { NavHeader } from "@/components/home";
import { useToast } from "@/components/Toast";
import FiatSpaceScreen from "@/screens/FiatSpaceScreen";
import { C } from "@/theme/tokens";

// The LinkPay-powered fiat space: account number, deposits, activity.
export default function Fiat() {
  const [headerHeight, setHeaderHeight] = useState(0);
  const toast = useToast();

  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <FiatSpaceScreen
        top={headerHeight}
        onAdd={() => router.push("/fund")}
        onSend={() => router.push("/send")}
        onBills={() => router.push("/bills")}
        onProvision={() => router.push("/kyc")}
        // Checkout belongs to another lane and has no route yet. Until it
        // lands, say so plainly — the screen already explains the state, and
        // pushing at a screen that does not exist would be worse than waiting.
        onNeedsSubscription={() =>
          toast.info("Subscription required", "Naira features need an active subscription.")
        }
        onNeedsSignIn={() => router.push("/signin")}
        // onRemit intentionally not passed — cross-border is out of this
        // version, so the Remit action hides itself. Restore by passing it.
      />
      <NavHeader
        wordmark="FIAT"
        tagline="POWERED BY LINKPAY"
        direction="column"
        unread
        onBack={() => router.back()}
        onHeightChange={setHeaderHeight}
      />
    </View>
  );
}
