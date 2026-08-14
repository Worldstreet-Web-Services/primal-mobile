import { View } from "react-native";

import ProfileScreen from "@/screens/ProfileScreen";
import { C } from "@/theme/tokens";

// Pushed route now that the tab bar is gone, so the screen keeps its own plain
// title and the default tail space — nothing floats over the content.
export default function Profile() {
  return (
    <View style={{ flex: 1, backgroundColor: C.canvas }}>
      <ProfileScreen />
    </View>
  );
}
