import { router } from "expo-router";

import { useAuth } from "@/lib/auth/AuthContext";
import ReceiveSheet from "@/screens/ReceiveSheet";

// Design 4c/4d. Crypto addresses come from the Decane wallet; the fiat account
// number comes from the gateway (src/lib/gateway/linkpay getAccount).
export default function Receive() {
  const { addresses } = useAuth();
  return <ReceiveSheet onClose={() => router.back()} addresses={addresses} />;
}
