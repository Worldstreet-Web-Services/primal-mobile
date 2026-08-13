import { Screen } from "@/components/ui";
import { C } from "@/theme/tokens";
import { Text } from "react-native";

const HomeScreen = () => {
  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: "bold", color: C.text }}>
        Portfolio
      </Text>
    </Screen>
  );
};

export default HomeScreen;
