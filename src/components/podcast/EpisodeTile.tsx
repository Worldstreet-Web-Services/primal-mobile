import { type ImageSource } from "expo-image";
import { ScrollView, Text, View } from "react-native";

import { ArtSlot } from "../home";
import { PlayIcon } from "../icons";
import { PressableScale } from "../ui";

export interface Episode {
  key: string;
  title: string;
  artwork?: ImageSource | number;
  /** 0–1 of the way through. Omit for an untouched episode. */
  progress?: number;
  /** Position readout beside the scrubber, e.g. "02:33". */
  elapsed?: string;
}

/**
 * The scrubber red is the platform's playback convention, not `C.down` — this
 * screen has no money on it, and a pale loss-pink would read as an error.
 */
const SCRUB = "#E5484D";

/**
 * One episode as a square of artwork with the play affordance floated on top,
 * and the scrubber along the bottom edge when it has been started.
 *
 * The title is deliberately absent: the grid reads as a wall of covers, and the
 * episode's name belongs to the player it opens.
 */
export function EpisodeTile({
  episode,
  onPress,
  size = 158,
  radius = 12,
}: {
  episode: Episode;
  onPress?: (key: string) => void;
  size?: number;
  radius?: number;
}) {
  const started = episode.progress !== undefined && episode.progress > 0;

  return (
    <PressableScale onPress={() => onPress?.(episode.key)} scale={0.97}>
      <View
        accessibilityRole="button"
        accessibilityLabel={episode.title}
        className="overflow-hidden bg-canvas-raised items-center justify-center"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
      >
        <ArtSlot
          source={episode.artwork}
          fill
          contentFit="cover"
          size={size * 0.55}
        />

        {/* Translucent rather than solid: the cover has to stay legible under
            the control, since the artwork is what identifies the episode. */}
        <View
          className="absolute w-[42px] h-[42px] rounded-[21px] items-center justify-center"
          style={{
            backgroundColor: "rgba(255,255,255,0.28)",
          }}
        >
          {/* Nudged right: a triangle's optical center sits left of its box. */}
          <PlayIcon size={15} color="rgba(255,255,255,0.95)" />
        </View>

        {started ? (
          <View className="absolute left-[10px] right-[10px] bottom-[10px] flex-row items-center gap-[8px]">
            <View
              className="flex-1 h-[3px] rounded-[2px] overflow-hidden"
              style={{
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            >
              <View
                className="rounded-[2px]"
                style={{
                  width: `${Math.min(Math.max(episode.progress!, 0), 1) * 100}%`,
                  height: "100%",
                  backgroundColor: SCRUB,
                }}
              />
            </View>
            {episode.elapsed ? (
              <Text
                className="font-mono text-[8px]"
                style={{
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {episode.elapsed}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

/**
 * The episode wall: a horizontal rail whose items stack `rows` deep, so it
 * scrolls sideways as a block instead of as separate rows that drift out of
 * alignment with each other.
 *
 * `bleed` is the page gutter, given back so the rail runs edge to edge while
 * its first column still lines up with the content above it.
 */
export function EpisodeGrid({
  episodes,
  onOpen,
  rows = 2,
  gap = 12,
  bleed = 0,
  size = 158,
}: {
  episodes: Episode[];
  onOpen?: (key: string) => void;
  /** Tiles per column. */
  rows?: number;
  gap?: number;
  bleed?: number;
  size?: number;
}) {
  // Column-major: filling down before across is what keeps the columns aligned
  // when the list doesn't divide evenly.
  const columns: Episode[][] = [];
  for (let i = 0; i < episodes.length; i += rows) {
    columns.push(episodes.slice(i, i + rows));
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={size + gap}
      style={{ marginHorizontal: -bleed }}
      contentContainerStyle={{ paddingHorizontal: bleed, gap }}
    >
      {columns.map((column, i) => (
        <View key={i} style={{ gap }}>
          {column.map((episode) => (
            <EpisodeTile
              key={episode.key}
              episode={episode}
              onPress={onOpen}
              size={size}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
