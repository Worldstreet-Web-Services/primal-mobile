import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassSurface, LIQUID_GLASS } from "@/components/ui";
import { C, F } from "@/theme/tokens";
import { GearIcon, HomeIcon, MicIcon, NewsIcon } from "../icons";

export interface Tab {
  key: string;
  label: string;
  icon: (props: {
    size?: number;
    color?: string;
    filled?: boolean;
  }) => React.ReactNode;
  /** Absent = not built yet. The tab is drawn, quietly, and is inert. */
  href?: string;
}

export const TABS: Tab[] = [
  { key: "home", label: "Home", icon: HomeIcon, href: "/home" },
  { key: "news", label: "News", icon: NewsIcon, href: "/news" },
  { key: "podcast", label: "Podcast", icon: MicIcon, href: "/podcast" },
  { key: "settings", label: "Settings", icon: GearIcon },
];

const BAR_H = 64;
const RADIUS = 20;
const SIDE = 22;
const INSET = 14;

const GLYPH = 23;
const GAP = 3;
const LABEL_H = 15;

export const TAB_BAR_CLEARANCE = BAR_H + 26;

function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: Tab;
  active: boolean;
  onPress?: (key: string) => void;
}) {
  const dead = !tab.href;
  // Three states, not two: the one you are on, the ones you can reach, and the
  // ones that do not exist yet.
  const ink = active ? C.text : dead ? C.figureTail : C.dim;

  return (
    <Pressable
      onPress={dead ? undefined : () => onPress?.(tab.key)}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: dead }}
      accessibilityLabel={dead ? `${tab.label}, not available yet` : tab.label}
      style={({ pressed }) => ({
        opacity: pressed && !dead ? 0.6 : 1,
      })}
      className="flex-1 flex-col items-center gap-1"
    >
      <View
        style={{
          width: GLYPH,
          height: GLYPH,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {tab.icon({ size: 24, color: ink, filled: active })}
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontFamily: active ? F.bodySemibold : F.body,
          fontSize: 14,
          lineHeight: LABEL_H,
          marginTop: GAP,

          color: ink,
        }}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function TabBar({
  active,
  tabs = TABS,
  onSelect,
  style,
}: {
  /** `key` of the current destination. */
  active: string;
  tabs?: Tab[];
  onSelect?: (key: string) => void;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          position: "absolute",
          left: SIDE,
          right: SIDE,
          bottom: Math.max(insets.bottom, 12),
          height: BAR_H,
          borderRadius: RADIUS,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: INSET,
          justifyContent: "space-around",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* Absolutely filled sibling BEHIND the buttons, so the container itself
          stays transparent — see `GlassSurface`. */}
      <GlassSurface
        radius={RADIUS}
        effect={LIQUID_GLASS ? "regular" : "none"}
        tintOpacity={0.5}
      />
      {tabs.map((tab) => (
        <TabButton
          key={tab.key}
          tab={tab}
          active={tab.key === active}
          onPress={onSelect}
        />
      ))}
    </View>
  );
}
