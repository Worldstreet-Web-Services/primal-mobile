import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
  type BottomSheetBackgroundProps,
} from "@gorhom/bottom-sheet";
import { type GlassStyle } from "expo-glass-effect";
import React, { useCallback, useEffect, useRef } from "react";
import { useWindowDimensions, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "../theme/tokens";
import { GlassSurface } from "./ui";

/**
 * A summoned bottom sheet on a glass ground.
 *
 * Built on `@gorhom/bottom-sheet`, which owns the gesture, the physics and the
 * portalling — a hand-rolled PanResponder loses the drag to the Pressables
 * inside the sheet, and a re-presented native glass layer drops its blur.
 *
 * Three ways out, all landing on `onClose`: drag it down, tap the scrim, or
 * Android back. Content is handed `close` so its own back/× controls agree
 * with the gesture instead of fighting it.
 */
export function Sheet({
  visible,
  onClose,
  children,
  draggable = true,
  radius = 26,
  effect = "clear",
  tintOpacity = 0.9,
  contentStyle,
}: {
  visible: boolean;
  onClose: () => void;
  /** Given `close` so the content's own back/dismiss controls can use it. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  /** Drag-to-dismiss, the grabber, and scrim-tap. Off pins the sheet open. */
  draggable?: boolean;
  radius?: number;
  effect?: GlassStyle;
  tintOpacity?: number;
  contentStyle?: ViewStyle;
}) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Dismissing a sheet that was never presented latches it shut for good: the
  // modal marks itself `DISMISSING`, and since there is no mounted sheet to
  // animate closed, nothing ever clears that back to idle — every later
  // `present()` is then dropped before it can render. So only ever dismiss a
  // sheet we actually opened.
  const presented = useRef(false);

  useEffect(() => {
    if (visible) {
      presented.current = true;
      sheet.current?.present();
    } else if (presented.current) {
      presented.current = false;
      sheet.current?.dismiss();
    }
  }, [visible]);

  const close = useCallback(() => sheet.current?.dismiss(), []);

  // Closed from inside — a drag, the scrim, or Android back. The flag has to
  // clear here too, or the `visible` flip this triggers would fire a second,
  // latching dismiss on the way out.
  const dismissed = useCallback(() => {
    presented.current = false;
    onClose();
  }, [onClose]);

  // Glass rather than the default opaque sheet. Rendered as the background
  // component so the library still owns sizing and the corner curve.
  const background = useCallback(
    ({ style }: BottomSheetBackgroundProps) => (
      <View
        style={[
          style,
          {
            overflow: "hidden",
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderTopWidth: 1,
            borderTopColor: C.border,
          },
        ]}
      >
        <GlassSurface
          radius={0}
          bordered={false}
          effect={effect}
          tintOpacity={tintOpacity}
          style={{
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
          }}
        />
      </View>
    ),
    [effect, radius, tintOpacity],
  );

  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior={draggable ? "close" : "none"}
      />
    ),
    [draggable],
  );

  return (
    <BottomSheetModal
      ref={sheet}
      onDismiss={dismissed}
      enablePanDownToClose={draggable}
      enableDynamicSizing
      // Tall checkouts stop short of the status bar instead of covering it.
      maxDynamicContentSize={height - insets.top - 24}
      backgroundComponent={background}
      backdropComponent={backdrop}
      handleStyle={{ display: draggable ? "flex" : "none", paddingTop: 12 }}
      handleIndicatorStyle={{
        width: 42,
        height: 4,
        backgroundColor: C.borderStrong,
      }}
    >
      <BottomSheetScrollView
        // The gesture reads the scroll position, so the sheet only starts
        // dragging once the content is already at the top.
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: draggable ? 4 : 20,
          paddingBottom: Math.max(insets.bottom, 16) + 12,
          ...contentStyle,
        }}
        showsVerticalScrollIndicator={false}
      >
        {typeof children === "function" ? children(close) : children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
