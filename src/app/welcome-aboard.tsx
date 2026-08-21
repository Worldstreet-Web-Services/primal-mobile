import { router } from "expo-router";
import { useState } from "react";

import WelcomeAboardScreen from "@/screens/WelcomeAboardScreen";

/* Full-bleed by design — the rays run under the status bar and off all four
   edges, so the screen applies its own insets. */
export default function WelcomeAboard() {
  const [leaving, setLeaving] = useState(false);

  // `replace`, not `push`: this beat is shown once, and leaving it in the back
  // stack means a swipe-back from the home screen lands a member on their own
  // welcome again.
  //
  // The cover goes up before the navigation because the hand-off is not free —
  // /home mounts a full dashboard, and without it the last thing pressed is a
  // button that appears to do nothing for a beat. The route unmounts with the
  // overlay still up, which is the intended exit.
  const onContinue = () => {
    setLeaving(true);
    // Back to the entry gate, not straight to /home. Membership is now settled
    // BEFORE onboarding, so a member arriving here may still have no PIN — and
    // "/" is the one place that knows whether the next step is the app or the
    // rest of setup. Jumping to /home would skip the app lock entirely.
    router.replace("/");
  };

  return <WelcomeAboardScreen onContinue={onContinue} busy={leaving} />;
}
