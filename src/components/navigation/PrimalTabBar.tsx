import type { BottomTabBarProps } from "expo-router/js-tabs";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { C, F } from "../../theme/tokens";
import {
  ChartIcon,
  HomeIcon,
  LayersIcon,
  PersonIcon,
  type IconProps,
} from "../icons";
import { GlassSurface } from "../ui";

type IconComponent = (props: IconProps) => React.ReactElement;

/** Route name → icon. Unknown routes fall back to the layers glyph. */
const ICONS: Record<string, IconComponent> = {
  home: HomeIcon,
  portfolio: ChartIcon,
  pulse: LayersIcon,
  profile: PersonIcon,
};

const RADIUS = 24;

function isHidden(itemStyle: StyleProp<ViewStyle>): boolean {
  return StyleSheet.flatten(itemStyle)?.display === "none";
}

/**
 * Floating pill tab bar. Replaces the platform bar so the home screen's cards
 * can scroll under it — content keeps a matching tail space (`Screen.bottom`).
 */
export function PrimalTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
        flexDirection: "row",
        alignItems: "center",
        height: 66,
        borderRadius: RADIUS,
        paddingHorizontal: 6,
        ...Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOpacity: 0.5,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
          },
          // Elevation paints an opaque shadow surface, so the fill has to stay
          // on the background layer for Android to keep any translucency.
          android: { elevation: 12 },
          default: {},
        }),
      }}
    >
      <GlassSurface radius={RADIUS} />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        // `href: null` screens belong to the navigator but own no button —
        // expo-router marks them by hiding the item, which a custom bar has
        // to honour itself.
        if (isHidden(options.tabBarItemStyle)) return null;

        const focused = state.index === index;
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);
        const Icon = ICONS[route.name] ?? LayersIcon;
        const color = focused ? C.brandSoft : C.sub;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() =>
              navigation.emit({ type: "tabLongPress", target: route.key })
            }
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 5,
              paddingVertical: 8,
            }}
          >
            <Icon size={21} color={color} filled={focused} />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: focused ? F.bodySemibold : F.body,
                fontSize: 10.5,
                color,
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
