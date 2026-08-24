import { View } from "react-native";

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
    <View className="flex-row items-center gap-[7px]">
      <Body className="text-brand font-body-medium" size={size}>
        {channel}
      </Body>
      <View className="w-[3px] h-[3px] rounded-[2px] bg-dim" />
      <Body className="text-dim" size={size}>
        {age}
      </Body>
    </View>
  );
}
