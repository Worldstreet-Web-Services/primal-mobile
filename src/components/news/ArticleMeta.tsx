import { View } from "react-native";

import { C, F } from "../../theme/tokens";
import { Body } from "../ui";

/**
 * Publisher and age, the byline that sits under every headline in the feed.
 * The channel carries the brand color, the age stays quiet — that contrast is
 * what lets a reader scan sources without reading them.
 */
export function ArticleMeta({
  channel,
  age,
  size = 11.5,
}: {
  channel: string;
  age: string;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Body size={size} color={C.brand} style={{ fontFamily: F.bodyMedium }}>
        {channel}
      </Body>
      <View
        style={{
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: C.dim,
        }}
      />
      <Body size={size} color={C.dim}>
        {age}
      </Body>
    </View>
  );
}
