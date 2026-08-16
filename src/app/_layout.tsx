import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PinPromptProvider } from "@/components/PinPrompt";
import { PrivacyOverlay } from "@/components/PrivacyOverlay";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { LockGate } from "@/lib/auth/LockGate";
import { C } from "@/theme/tokens";

import "../global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Urbanist is the whole voice now (2026-08-16). Static instances rather
    // than the variable TTF — RN maps fontFamily to a concrete face, so weight
    // axes don't resolve on Android.
    "Urbanist-Regular": require("@/assets/fonts/Urbanist-Regular.ttf"),
    "Urbanist-Medium": require("@/assets/fonts/Urbanist-Medium.ttf"),
    "Urbanist-SemiBold": require("@/assets/fonts/Urbanist-SemiBold.ttf"),
    "Urbanist-Bold": require("@/assets/fonts/Urbanist-Bold.ttf"),
    "Urbanist-ExtraBold": require("@/assets/fonts/Urbanist-ExtraBold.ttf"),
    // Kept for figures only — see the note on `F.mono` in theme/tokens.
    "GeistMono-Regular": require("@/assets/fonts/GeistMono-Regular.ttf"),
    "GeistMono-SemiBold": require("@/assets/fonts/GeistMono-SemiBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // Gesture root is required for any RNGH gesture, so it stays outermost.
    // SafeAreaProvider is explicit because the toast and the PIN prompt render
    // outside the navigator, so they can't rely on the one react-navigation
    // installs. The modal provider is the portal every `Sheet` mounts into,
    // which is what keeps a sheet clear of the clipping and stacking of
    // whatever opened it.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ToastProvider>
            {/* Inside the toast provider so a failed PIN can still surface one,
                and outside the navigator so the prompt survives route changes. */}
            <PinPromptProvider>
              <BottomSheetModalProvider>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: C.canvas },
                  }}
                />
                {/* Renders nothing — sends a locked app back to /unlock no
                    matter which route a deep link mounted. */}
                <LockGate />
                {/* Last sibling, so it covers every route including modals. */}
                <PrivacyOverlay />
              </BottomSheetModalProvider>
            </PinPromptProvider>
          </ToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
