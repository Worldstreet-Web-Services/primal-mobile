import { Pressable, ScrollView, Text, View } from "react-native";

import { C, F } from "../../theme/tokens";

/**
 * The feed's section filter: a scrolling row of plain labels, the active one
 * lit and underlined. Deliberately not `SegTabs` — that control is a filled
 * selector for two or three options, and this list runs off the screen edge.
 *
 * `bleed` is the screen's own gutter, given back so the row can scroll from
 * edge to edge while its first label still lines up with the content above it.
 */
export function CategoryTabs({
  categories,
  active,
  onChange,
  bleed = 0,
}: {
  categories: string[];
  active: number;
  onChange?: (index: number) => void;
  bleed?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={{ paddingHorizontal: bleed, gap: 22 }}
    >
      {categories.map((category, i) => {
        const on = i === active;
        return (
          <Pressable
            key={category}
            onPress={() => onChange?.(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ paddingVertical: 8 }}
          >
            <Text
              style={{
                fontFamily: on ? F.bodySemibold : F.body,
                fontSize: 13,
                color: on ? C.text : C.sub,
              }}
            >
              {category}
            </Text>
            {/* Drawn only when active, so the row keeps a single baseline. */}
            {on ? (
              <View
                style={{
                  marginTop: 6,
                  height: 2,
                  borderRadius: 2,
                  backgroundColor: C.brand,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
