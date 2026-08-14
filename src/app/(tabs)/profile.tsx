import { Screen } from "@/components/ui";
import { C } from "@/theme/tokens";
import { Text } from "react-native";

const ProfileScreen = () => {
  return (
    <Screen center bottom={110}>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: C.text }}>
        Profile
      </Text>
    </Screen>
  );
};

export default ProfileScreen;
