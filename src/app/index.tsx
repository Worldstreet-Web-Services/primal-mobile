import { Redirect } from "expo-router";
import { useState } from "react";

import { Splash } from "@/components/Splash";

// Entry: the animated splash plays once, then hands off to onboarding. The
// native splash (expo-splash-screen) covers font loading before this mounts,
// so the mark appears to carry straight through from launch.
export default function Index() {
  const [finished, setFinished] = useState(false);

  if (finished) return <Redirect href="/welcome" />;

  return <Splash animated onDone={() => setFinished(true)} />;
}
