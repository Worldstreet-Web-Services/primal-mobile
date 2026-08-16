import { router } from "expo-router";

import ContinueScreen from "@/screens/ContinueScreen";

/* Full-bleed by design — the backdrop runs under the status bar, so the screen
   applies the insets itself. */
export default function Continue() {
  // `replace` through "/" — the entry gate weighs membership and the app lock
  // together, and `push`ing at /home both skipped that and left this screen in
  // the back stack for a swipe to return to.
  return <ContinueScreen onContinue={() => router.replace("/")} />;
}
