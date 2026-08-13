import { Screen } from "@/components/ui";
import { C } from "@/theme/tokens";
import { Text } from "react-native";

const PulseScreen = () => {
  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: C.text }}>
        PulseScreen
      </Text>
    </Screen>
  );
};

export default PulseScreen;
