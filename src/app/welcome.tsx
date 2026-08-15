import { router } from "expo-router";

import WelcomeScreen from "@/screens/WelcomeScreen";

/* Full-bleed by design — the mark runs under the status bar and the drawer to
   the bottom edge, so the screen applies the insets itself. */
export default function Welcome() {
  // Get Access hands off to the provider picker, which is where auth (Decane +
  // KingsChat) actually starts.
  return <WelcomeScreen onLogin={() => router.push("/signin")} />;
}
