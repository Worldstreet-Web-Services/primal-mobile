import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

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
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0A0B0D" },
        }}
      />
      {/* Last sibling, so it covers every route including modals. */}
      <PrivacyOverlay />
    </>
  );
}
