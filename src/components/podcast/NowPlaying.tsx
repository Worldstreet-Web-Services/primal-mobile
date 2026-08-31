import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  GestureDetector,
  type ComposedGesture,
  type GestureType,
} from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CastIcon,
  ChevronDownIcon,
  ClockIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  SeekIcon,
  ShareIcon,
  ShuffleIcon,
} from "@/components/icons";
import { Body, Display, Label, Mono, PressableScale } from "@/components/ui";
import { episodeById } from "@/data/podcast";
import {
  SEEK_BACK_SEC,
  SEEK_FORWARD_SEC,
  usePlayerStore,
} from "@/store/player";
import { useTokens } from "@/theme/tokens";
import { EpisodeArt } from "./EpisodeArt";
import { Scrubber } from "./Scrubber";

const GUTTER = 20;
/** Diameter of the primary transport control. */
const PLAY = 74;

/**
 * The full-screen player.
 *
 * Everything on it is a view of `usePlayerStore` — the component holds no
 * playback state of its own, which is what lets the same transport keep running
 * under the mini bar once this is dismissed.
 *
 * The accent is `amber`, not `brand`. Green is the app's money colour: it marks
 * a gain, a confirmed transfer, a live balance. Borrowing it for a play button
 * would put the same signal on a control that has nothing to do with money.
 * Amber is the palette's other saturated hue and matches the podcast artwork's
 * own gold, so the transport reads as its own register.
 *
 * `dragGesture` is the host's minimise drag. It is attached to the header and
 * the artwork only — a pan over the whole sheet would fight the scroll view.
 */
export function NowPlaying({
  dragGesture,
  onSeeAll,
}: {
  dragGesture?: ComposedGesture | GestureType;
  onSeeAll?: () => void;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const episode = usePlayerStore((s) => s.episode);
  const playing = usePlayerStore((s) => s.playing);
  const rate = usePlayerStore((s) => s.rate);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);

  const toggle = usePlayerStore((s) => s.toggle);
  const skip = usePlayerStore((s) => s.skip);
  const cycleRate = usePlayerStore((s) => s.cycleRate);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const minimize = usePlayerStore((s) => s.minimize);
  const play = usePlayerStore((s) => s.play);

  if (!episode) return null;

  const upNext =
    index >= 0 && index + 1 < queue.length
      ? episodeById(queue[index + 1])
      : undefined;

  const head = (
    <View>
      <View
        className="flex-row items-center px-[20px] pb-[18px]"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          onPress={minimize}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Minimise player"
        >
          <ChevronDownIcon size={24} color={t.text} />
        </Pressable>

        <View className="flex-1 items-center">
          <Label className="text-[11px] tracking-[2.4px] text-text">
            Now playing
          </Label>
        </View>

        {/* Drawn but inert — the episode's own overflow menu is on the episode
            page, and duplicating it here with nothing behind it would be a
            second dead target. */}
        <Pressable hitSlop={14} disabled accessibilityElementsHidden>
          <MoreIcon size={20} color={t.text} />
        </Pressable>
      </View>

      <View className="px-[20px]">
        <EpisodeArt source={episode.artwork} width={width - GUTTER * 2} />
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-canvas">
      {dragGesture ? (
        <GestureDetector gesture={dragGesture}>{head}</GestureDetector>
      ) : (
        head
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: 26,
          paddingBottom: insets.bottom + 36,
        }}
      >
        <Display
          numberOfLines={2}
          className="font-display-bold text-[23px] leading-[28px] tracking-[0.2px]"
        >
          {episode.title.toUpperCase()}
        </Display>

        <View className="mt-[8px] flex-row items-center gap-[7px]">
          <Mono className="font-mono-semibold text-[12px] tracking-[1.4px] text-amber">
            PODCAST
          </Mono>
          <View className="h-[3px] w-[3px] rounded-full bg-dim" />
          <Body numberOfLines={1} className="flex-1 text-[13px] text-sub">
            by {episode.author}
          </Body>
        </View>

        <View className="mt-[14px]">
          <LiveScrubber duration={episode.durationSec} accent={t.amber} />
        </View>

        <View className="mt-[16px] flex-row items-center justify-between">
          <TransportButton
            label={shuffle ? "Shuffle on" : "Shuffle off"}
            onPress={toggleShuffle}
          >
            <ShuffleIcon size={22} color={shuffle ? t.amber : t.silver} />
          </TransportButton>

          <TransportButton
            label={`Back ${SEEK_BACK_SEC} seconds`}
            onPress={() => skip(-SEEK_BACK_SEC)}
          >
            <SeekIcon size={27} color={t.text} back seconds={SEEK_BACK_SEC} />
          </TransportButton>

          <PressableScale
            onPress={toggle}
            scale={0.94}
            accessibilityLabel={playing ? "Pause" : "Play"}
          >
            <View
              className="items-center justify-center rounded-full bg-amber"
              style={{ width: PLAY, height: PLAY }}
            >
              {playing ? (
                <PauseIcon size={27} color={t.amberInk} />
              ) : (
                // Nudged right: a triangle's optical centre sits left of its
                // box, so a centred one reads as sitting too far left.
                <View style={{ marginLeft: 4 }}>
                  <PlayIcon size={29} color={t.amberInk} />
                </View>
              )}
            </View>
          </PressableScale>

          <TransportButton
            label={`Forward ${SEEK_FORWARD_SEC} seconds`}
            onPress={() => skip(SEEK_FORWARD_SEC)}
          >
            <SeekIcon size={27} color={t.text} seconds={SEEK_FORWARD_SEC} />
          </TransportButton>

          <TransportButton label={`Repeat ${repeat}`} onPress={cycleRepeat}>
            <RepeatIcon
              size={22}
              one={repeat === "one"}
              color={repeat === "off" ? t.silver : t.amber}
            />
          </TransportButton>
        </View>

        <View className="mt-[26px] flex-row items-center justify-between">
          <TransportButton label="Share episode" disabled>
            <ShareIcon size={20} color={t.silver} />
          </TransportButton>

          {/* The one control on the row that states its value rather than its
              action, so it is lettering on a chip instead of a glyph. */}
          <Pressable
            onPress={cycleRate}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${rate}x`}
            className="h-[26px] items-center justify-center bg-canvas-inset px-[10px]"
            style={{ borderRadius: 8 }}
          >
            <Text className="font-mono-semibold text-[12px] text-text">
              {Number.isInteger(rate) ? rate.toFixed(1) : rate}x
            </Text>
          </Pressable>

          <TransportButton label="Sleep timer" disabled>
            <ClockIcon size={20} color={t.silver} />
          </TransportButton>

          <TransportButton label="Play on another device" disabled>
            <CastIcon size={20} color={t.silver} />
          </TransportButton>
        </View>

        <View className="mt-[30px] flex-row items-center justify-between">
          <Label className="text-[11px] tracking-[2px] text-text">
            Up next
          </Label>
          {onSeeAll ? (
            <Pressable
              onPress={onSeeAll}
              hitSlop={10}
              accessibilityRole="button"
            >
              <Body className="font-body-medium text-[12.5px] text-amber">
                See All
              </Body>
            </Pressable>
          ) : null}
        </View>

        {upNext ? (
          <PressableScale
            onPress={() => play(upNext.key)}
            scale={0.98}
            style={{ marginTop: 12 }}
          >
            <View className="flex-row items-center gap-[12px] rounded-[14px] bg-canvas-inset p-[10px]">
              <EpisodeArt
                source={upNext.artwork}
                width={44}
                ratio={1}
                radius={8}
              />
              <View className="flex-1">
                <Body
                  numberOfLines={1}
                  className="font-body-semibold text-[14px]"
                >
                  {upNext.title}
                </Body>
                <Body
                  numberOfLines={1}
                  className="mt-[2px] text-[12px] text-dim"
                >
                  {upNext.author}
                </Body>
              </View>
            </View>
          </PressableScale>
        ) : (
          <Body className="mt-[12px] text-[12.5px] text-dim">
            Nothing queued after this one.
          </Body>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * The scrubber, wired to the transport.
 *
 * Split out for one reason: it is the only thing on this page that moves on
 * every tick. Subscribing to `positionSec` from the player itself would repaint
 * the artwork, the title and both control rows four times a second to advance a
 * knob. Everything else here reads state that changes when a control is
 * pressed, and repaints then.
 */
function LiveScrubber({
  duration,
  accent,
}: {
  duration: number;
  accent: string;
}) {
  const position = usePlayerStore((s) => s.positionSec);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const setScrubbing = usePlayerStore((s) => s.setScrubbing);

  return (
    <Scrubber
      position={position}
      duration={duration}
      accent={accent}
      onSeek={seekTo}
      onScrubbingChange={setScrubbing}
    />
  );
}

/** A bare glyph target on the transport rows — no chrome, just a hit area. */
function TransportButton({
  children,
  label,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {children}
    </Pressable>
  );
}
