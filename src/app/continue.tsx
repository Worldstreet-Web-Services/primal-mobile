import { router } from "expo-router";

import ContinueScreen from "@/screens/ContinueScreen";

/* Full-bleed by design — the backdrop runs under the status bar, so the screen
   applies the insets itself. */
export default function Continue() {
  return <ContinueScreen onContinue={() => router.push("/home")} />;
}
