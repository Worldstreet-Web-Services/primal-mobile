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
    // Back to the entry gate, not straight to /home. This screen is the last
    // beat of the sequence "/" owns end to end — sign in, app lock, membership,
    // welcome — and handing back to it means the destination is decided by the
    // same file that decided every step before it. Naming /home here would
    // assert an answer this screen has no way to check.
    router.replace("/");
  };

  return <WelcomeAboardScreen onContinue={onContinue} busy={leaving} />;
}
