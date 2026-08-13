import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas px-6">
      <Text className="text-3xl font-bold text-silver">Primal</Text>
      <Text className="mt-2 text-center text-silver-muted">
        One account. Fiat and crypto.
      </Text>
      <Link href="/receive" asChild>
        <Text className="mt-8 rounded-xl bg-lime px-6 py-3 font-semibold text-lime-ink">
          Receive money
        </Text>
      </Link>
    </View>
  );
}
