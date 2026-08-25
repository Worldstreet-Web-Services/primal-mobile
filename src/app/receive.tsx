import { router } from "expo-router";

import { SUBSCRIPTION_ROUTE } from "@/lib/routes";
import ReceiveSheet from "@/screens/ReceiveSheet";

// The public Gateway currently exposes LinkPay bank deposits only. General
// crypto deposit addresses stay absent until the Gateway owns that provider
// interaction and returns a documented address contract.
export default function Receive() {
  return (
    <ReceiveSheet
      onClose={() => router.back()}
      onProvision={() => router.push("/kyc")}
      onNeedsSubscription={() => router.push(SUBSCRIPTION_ROUTE)}
      onNeedsSignIn={() => router.push("/signin")}
    />
  );
}
