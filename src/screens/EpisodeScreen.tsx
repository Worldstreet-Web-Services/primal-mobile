import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  BackChevron,
  Body,
  CircleAction,
  Display,
  Label,
  Mono,
  PressableScale,
  Screen,
} from "@/components/ui";
import {
  DownloadIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  ShareIcon,
  WaveIcon,
} from "@/components/icons";
import { EpisodeArt, useMiniPlayerClearance } from "@/components/podcast";
import { formatTime, type PodcastEpisode } from "@/data/podcast";
import { usePlayerStore } from "@/store/player";
import { useTokens } from "@/theme/tokens";

const GUTTER = 20;
/** Diameter of the play control floated on the artwork. */
const PLAY = 54;

export interface EpisodeScreenProps {
  episode: PodcastEpisode;
  onBack?: () => void;
}

/**
 * One episode: its cover, what it is about, and the chapters you can drop into.
 *
 * The page does not own playback — it hands keys and offsets to the transport
 * store and reads the result back, so tapping a chapter here and dragging the
 * scrubber in the full player are the same operation on the same state.
 *
 * The title is set below full contrast on purpose. The artwork above it already
 * carries the episode's name at display size; repeating it in white would give
 * the page two headlines competing for the same glance, so the type here reads
 * as the caption it actually is.
 */
export default function EpisodeScreen({ episode, onBack }: EpisodeScreenProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const clearance = useMiniPlayerClearance();

  const loaded = usePlayerStore((s) => s.episode?.key === episode.key);
  const playing = usePlayerStore((s) => s.playing) && loaded;
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const expand = usePlayerStore((s) => s.expand);

  /** Start it, or take over the transport if something else is loaded. */
  const onPlay = () => (loaded ? toggle() : play(episode.key));

  /** Chapter tap: play from that mark, and open the player it now belongs to. */
  const openAt = (at: number) => {
    if (!loaded) play(episode.key);
    else expand();
    seekTo(at);
  };

  // Which chapter the playhead is inside — the last one that has started.
  //
  // Derived INSIDE the selector rather than from a subscribed `positionSec`:
  // the position moves four times a second and this page has no other reason to
  // repaint, so the selector reduces the tick to a chapter key that changes
  // twice an episode.
  const activeChapter = usePlayerStore((s) =>
    s.episode?.key !== episode.key
      ? null
      : episode.chapters.reduce<string | null>(
          (found, chapter) =>
            s.positionSec >= chapter.at ? chapter.key : found,
          null,
        ),
  );

  return (
    <View className="flex-1 bg-canvas">
      <View
        className="flex-row items-center px-[16px] pb-[10px]"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <BackChevron color={t.text} />
        </Pressable>

        {/* The section's own mark, centred against the row rather than against
            what is left of it, so it stays put with one control on the left. */}
        <View className="flex-1 flex-row items-center justify-center gap-[7px] pr-[22px]">
          <WaveIcon size={13} color={t.text} />
          <Label className="text-[11px] tracking-[2.4px] text-text">
            Podcast
          </Label>
        </View>
      </View>

      <Screen pad={GUTTER} top={10} bottom={insets.bottom + clearance + 24}>
        <View>
          <PressableScale
            onPress={onPlay}
            scale={0.98}
            accessibilityLabel={`${episode.title}. ${playing ? "Pause" : "Play"}`}
          >
            <EpisodeArt source={episode.artwork} width={width - GUTTER * 2} />
          </PressableScale>

          {/* Not in the comp, and deliberate: the comp's artwork is the play
              target with nothing to say so. This states it, without covering
              the cover. */}
          <View className="absolute bottom-[-16px] right-[14px]">
            <PressableScale
              onPress={onPlay}
              scale={0.94}
              accessibilityLabel={playing ? "Pause" : "Play"}
            >
              <View
                className="items-center justify-center rounded-full bg-amber"
                style={{ width: PLAY, height: PLAY }}
              >
                {playing ? (
                  <PauseIcon size={19} color={t.amberInk} />
                ) : (
                  <View style={{ marginLeft: 3 }}>
                    <PlayIcon size={21} color={t.amberInk} />
                  </View>
                )}
              </View>
            </PressableScale>
          </View>
        </View>

        {/* Drawn, quietly inert: a library, downloads and a share sheet are all
            still to come, and a control that does nothing should not look any
            louder than one that does. */}
        <View className="mt-[26px] flex-row items-center gap-[14px]">
          <CircleAction size={38} accessibilityLabel="Add to library">
            <PlusIcon size={18} color={t.silver} />
          </CircleAction>
          <CircleAction size={38} accessibilityLabel="Download episode">
            <DownloadIcon size={19} color={t.silver} />
          </CircleAction>
          <View className="pl-[2px]">
            <Pressable hitSlop={12} disabled accessibilityElementsHidden>
              <ShareIcon size={20} color={t.silver} />
            </Pressable>
          </View>
          <Pressable hitSlop={12} disabled accessibilityElementsHidden>
            <MoreIcon size={19} color={t.silver} />
          </Pressable>
        </View>

        <Display
          numberOfLines={3}
          className="mt-[26px] font-display-bold text-[27px] leading-[32px] tracking-[-0.2px] text-figure-tail"
        >
          {episode.title}
        </Display>

        <Body className="mt-[16px] text-[13.5px] leading-[21px] text-sub">
          {episode.summary}
        </Body>

        <Display className="mt-[26px] text-[16px] leading-[17px]">
          Chapters
        </Display>

        <View className="mt-[14px]">
          {episode.chapters.map((chapter) => {
            const active = chapter.key === activeChapter;
            return (
              <Pressable
                key={chapter.key}
                onPress={() => openAt(chapter.at)}
                accessibilityRole="button"
                accessibilityLabel={`${chapter.title}, from ${formatTime(chapter.at)}`}
                className="py-[11px]"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Body
                  className={`text-[15px] ${active ? "font-body-semibold text-amber" : "text-text"}`}
                >
                  {chapter.title}
                </Body>
                <Mono
                  className={`mt-[3px] text-[12.5px] ${active ? "text-amber" : "text-dim"}`}
                >
                  {formatTime(chapter.at)}
                </Mono>
              </Pressable>
            );
          })}
        </View>
      </Screen>
    </View>
  );
}
