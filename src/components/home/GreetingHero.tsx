import { type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View } from "react-native";

import { C } from "../../theme/tokens";
import { RingDecor } from "../icons";
import { Display, PressableScale, Shine } from "../ui";
import { ArtSlot } from "./ArtSlot";

/**
 * The greeting slab. Deliberately holds no balance — money lives in the
 * spaces below; this card is the ambient "welcome back" moment.
 */
export function GreetingHero({
  greeting,
  name,
  artwork,
  onPress,
  height = 152,
}: {
  greeting: string;
  name: string;
  artwork?: ImageSource | number;
  onPress?: () => void;
  height?: number;
}) {
  return (
    <PressableScale onPress={onPress} scale={0.985}>
      <LinearGradient
        colors={["#141A0E", "#0D0F0C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: C.border,
          overflow: "hidden",
          justifyContent: "center",
          paddingHorizontal: 18,
        }}
      >
        <Shine />
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 40 }}
        >
          <RingDecor size={height * 1.9} color={C.leaf} opacity={0.2} />
        </View>

        <View style={{ maxWidth: "70%" }}>
          <Display size={32}>{greeting},</Display>
          <Display size={18} color={C.silver} style={{ marginTop: 8 }}>
            {name}
          </Display>
        </View>

        <ArtSlot
          source={artwork}
          size={160}
          style={{ position: "absolute", right: -5, top: height * 0.5 - 80 }}
        />
      </LinearGradient>
    </PressableScale>
  );
}
