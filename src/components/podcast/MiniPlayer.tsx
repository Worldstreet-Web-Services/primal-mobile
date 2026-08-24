import { Pressable, View } from "react-native";

import { CloseIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { Body, GlassSurface, PressableScale } from "@/components/ui";
import { usePlayerStore } from "@/store/player";
import { useTokens } from "@/theme/tokens";
import { EpisodeArt } from "./EpisodeArt";

/** Bar height, without the margin the host places it with. */
export const MINI_HEIGHT = 62;
const RADIUS = 16;
const ART = 42;

/**
 * The docked bar the full player minimises to — what playback looks like from
 * everywhere else in the app.
 *
 * Glass rather than a solid fill: it sits over whatever screen you happen to be
 * on, and an opaque slab there reads as a piece of that screen's chrome instead
 * of as something floating above it.
 *
 * Three targets, in the order they are wanted: the bar itself reopens the
 * player, the circle toggles playback, and the × unloads. The elapsed hairline
 * runs along the bottom edge — enough to say "you are part way through", and
 * not a control, because scrubbing belongs to the full player.
 */
export function MiniPlayer() {
  const t = useTokens();

  const episode = usePlayerStore((s) => s.episode);
  const playing = usePlayerStore((s) => s.playing);
  const toggle = usePlayerStore((s) => s.toggle);
  const expand = usePlayerStore((s) => s.expand);
  const close = usePlayerStore((s) => s.close);

  if (!episode) return null;

  return (
    <Pressable
      onPress={expand}
      accessibilityRole="button"
      accessibilityLabel={`${episode.title}. Open player`}
      className="overflow-hidden border border-border"
      style={{ height: MINI_HEIGHT, borderRadius: RADIUS }}
    >
      <GlassSurface radius={RADIUS} bordered={false} tintOpacity={0.62} />

      <View className="flex-1 flex-row items-center gap-[11px] px-[10px]">
        <EpisodeArt source={episode.artwork} width={ART} ratio={1} radius={9} />

        <View className="flex-1">
          <Body numberOfLines={1} className="font-body-semibold text-[13.5px]">
            {episode.title}
          </Body>
          <Body numberOfLines={1} className="mt-[1px] text-[11.5px] text-dim">
            {episode.author}
          </Body>
        </View>

        <PressableScale
          onPress={toggle}
          scale={0.9}
          accessibilityLabel={playing ? "Pause" : "Play"}
        >
          <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-amber">
            {playing ? (
              <PauseIcon size={14} color={t.ink} />
            ) : (
              <View style={{ marginLeft: 2 }}>
                <PlayIcon size={15} color={t.ink} />
              </View>
            )}
          </View>
        </PressableScale>

        <Pressable
          onPress={close}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Stop playing"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <CloseIcon size={17} color={t.dim} />
        </Pressable>
      </View>

      <Elapsed duration={episode.durationSec} accent={t.amber} />
    </Pressable>
  );
}

/**
 * The elapsed hairline, and the only part of the bar that moves on the tick.
 *
 * Its own component so the tick repaints two pixels of fill rather than the
 * artwork, the title and both controls — this bar is mounted over every screen
 * in the app for as long as something is playing, so what it costs per tick is
 * what the whole app pays.
 *
 * It sits on the bar's own bottom edge rather than above it: a progress line
 * inset from the edge reads as a divider.
 */
function Elapsed({ duration, accent }: { duration: number; accent: string }) {
  const position = usePlayerStore((s) => s.positionSec);
  const pct = Math.min(Math.max(position / duration, 0), 1);

  return (
    <View
      pointerEvents="none"
      className="absolute bottom-0 left-0 right-0 h-[2px]"
    >
      <View
        className="h-full"
        style={{ width: `${pct * 100}%`, backgroundColor: accent }}
      />
    </View>
  );
}
