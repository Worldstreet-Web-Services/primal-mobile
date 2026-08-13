import { router } from "expo-router";

import ReceiveSheet from "@/screens/ReceiveSheet";

// Design 4c/4d. Later this reads the real account number via src/lib/api
// (getMe/provisionAccount) instead of mock data.
export default function Receive() {
  return <ReceiveSheet onClose={() => router.back()} />;
}
