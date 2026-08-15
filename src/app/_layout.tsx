import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/auth/AuthContext";

import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Display face. Static instances rather than the variable TTF — RN maps
    // fontFamily to a concrete face, so weight axes don't resolve on Android.
    "SpaceGrotesk-SemiBold": require("@/assets/fonts/SpaceGrotesk-SemiBold.ttf"),
    "SpaceGrotesk-Bold": require("@/assets/fonts/SpaceGrotesk-Bold.ttf"),
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
    // SafeAreaProvider is explicit because the toast renders outside the
    // navigator, so it can't rely on the one react-navigation installs.
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0A0B0D" },
            }}
          />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
