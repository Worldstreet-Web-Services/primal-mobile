import { Image, type ImageSource } from "expo-image";
import { Text, View } from "react-native";

/**
 * Round asset/network mark. Renders the supplied logo when there is one and a
 * colored disc carrying the symbol's initial when there isn't — so a token can
 * be listed before its artwork has shipped.
 */
export function TokenBadge({
  symbol,
  artwork,
  color = "#2775CA",
  size = 30,
}: {
  symbol: string;
  artwork?: ImageSource | number;
  /** Disc color for the placeholder. Ignored once `artwork` is supplied. */
  color?: string;
  size?: number;
}) {
  if (artwork) {
    return (
      <Image
        source={artwork}
        contentFit="contain"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      className="items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    >
      <Text
        className="font-mono-semibold"
        style={{
          fontSize: size * 0.44,
          color: "#FFFFFF",
        }}
      >
        {symbol.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
