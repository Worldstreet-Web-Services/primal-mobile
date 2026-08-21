import { router } from "expo-router";

import WelcomeScreen from "@/screens/WelcomeScreen";

/* Full-bleed by design — the screen applies its own insets so the hero can sit
   in the whole frame. */
export default function Welcome() {
  // One CTA, one destination: the pitch hands off to the identity picker, which
  // is where auth (Decane + KingsChat) actually starts.
  return <WelcomeScreen onLogin={() => router.push("/signin")} />;
}
