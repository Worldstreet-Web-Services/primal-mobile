import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { PrivacyOverlay } from "@/components/PrivacyOverlay";

import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Display face: Mona Sans, matching wsws-frontend (Geist body + Mona Sans
    // headers). Static instances rather than the variable TTF — RN maps
    // fontFamily to a concrete face, so weight axes don't resolve on Android.
    "MonaSans-Medium": require("@/assets/fonts/MonaSans-Medium.ttf"),
    "MonaSans-SemiBold": require("@/assets/fonts/MonaSans-SemiBold.ttf"),
    "MonaSans-Bold": require("@/assets/fonts/MonaSans-Bold.ttf"),
    "Geist-Regular": require("@/assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("@/assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("@/assets/fonts/Geist-SemiBold.ttf"),
    "GeistMono-Regular": require("@/assets/fonts/GeistMono-Regular.ttf"),
    "GeistMono-SemiBold": require("@/assets/fonts/GeistMono-SemiBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // Gesture root is required for any RNGH gesture; the modal provider is the
    // portal every `Sheet` mounts into, which is what keeps a sheet clear of
    // the clipping and stacking of whatever opened it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0A0B0D" },
          }}
        />
        {/* Last sibling, so it covers every route including modals. */}
        <PrivacyOverlay />
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
