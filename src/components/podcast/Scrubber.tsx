import { useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { formatTime } from "@/data/podcast";
import { Mono } from "../ui";

/** Drawn height of the track. The touch target is the padded row around it. */
const TRACK_H = 4;
const KNOB = 13;
/** Vertical padding either side of the track — this is the real hit area. */
const TOUCH_PAD = 13;

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

/**
 * The playback scrubber: a filled track with a knob, and the elapsed / remaining
 * pair beneath it.
 *
 * While a finger is down the knob follows the touch and the times read from the
 * drag, not from the transport — the seek only lands on release. That is what
 * keeps the readout from flickering between where you are dragging to and where
 * playback still is, and it is why the component tells its owner when a drag
 * starts and ends rather than just emitting a final value.
 *
 * Remaining is shown as a negative, the way every podcast app writes it: it is
 * a countdown to the end of the episode, not a second elapsed figure.
 */
export function Scrubber({
  position,
  duration,
  accent,
  onSeek,
  onScrubbingChange,
}: {
  position: number;
  duration: number;
  /** Colour of the filled portion and the knob. */
  accent: string;
  onSeek: (seconds: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  /** Where the finger is, in seconds. Null when nobody is dragging. */
  const [drag, setDrag] = useState<number | null>(null);

  const at = (x: number) =>
    width <= 0 ? 0 : (clamp(x, width) / width) * duration;

  const shown = drag ?? position;
  const pct = duration > 0 ? clamp(shown, duration) / duration : 0;

  // `runOnJS` throughout: every handler below touches React state and the
  // transport store, neither of which exists on the UI thread. The track is a
  // few pixels tall and the numbers update at 4Hz, so there is nothing here
  // that needs a worklet.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      onScrubbingChange?.(true);
      setDrag(at(e.x));
    })
    .onUpdate((e) => setDrag(at(e.x)))
    .onEnd((e) => onSeek(at(e.x)))
    .onFinalize(() => {
      setDrag(null);
      onScrubbingChange?.(false);
    });

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Playback position"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
          style={{ paddingVertical: TOUCH_PAD }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
          <View
            className="w-full overflow-hidden rounded-full bg-border"
            style={{ height: TRACK_H }}
          >
            <View
              className="h-full rounded-full"
              // Width and fill are both computed — the fill is the accent the
              // player is themed on, not a class.
              style={{ width: `${pct * 100}%`, backgroundColor: accent }}
            />
          </View>

          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{
              width: KNOB,
              height: KNOB,
              backgroundColor: accent,
              top: TOUCH_PAD + TRACK_H / 2 - KNOB / 2,
              // Pulled back by its own radius so the knob's centre — not its
              // left edge — sits on the position.
              left: pct * width - KNOB / 2,
            }}
          />
        </View>
      </GestureDetector>

      <View className="mt-[2px] flex-row items-center justify-between">
        <Mono className="text-[12px] text-sub">{formatTime(shown)}</Mono>
        <Mono className="text-[12px] text-sub">
          -{formatTime(Math.max(duration - shown, 0))}
        </Mono>
      </View>
    </View>
  );
}
