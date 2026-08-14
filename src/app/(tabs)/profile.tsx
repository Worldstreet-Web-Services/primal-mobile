import { View } from "react-native";

import ProfileScreen from "@/screens/ProfileScreen";
import { C } from "@/theme/tokens";

/** Clears the floating tab bar, matching the other tab roots. */
const TAB_BAR_CLEARANCE = 110;

// Tab root, so there is nothing to go back to — the screen renders its own
// plain title instead of a back header.
export default function Profile() {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <ProfileScreen bottom={TAB_BAR_CLEARANCE} />
    </View>
  );
}
