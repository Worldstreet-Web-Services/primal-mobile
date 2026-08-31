import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PinPromptProvider } from "@/components/PinPrompt";
import { PlayerHost } from "@/components/podcast";
import { PrivacyOverlay } from "@/components/PrivacyOverlay";
import { ToastProvider } from "@/components/Toast";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { InactivityLock } from "@/lib/auth/InactivityLock";
import { LockGate } from "@/lib/auth/LockGate";
import { DEFAULT_THEME, hydrateTheme } from "@/theme/preference";
import { useTokens } from "@/theme/tokens";

import "../global.css";
// Side effect only: registers className support for non-RN components.
import "../lib/interop";

/**
 * Dark is the app's LAUNCH theme, and now also its default rather than its only
 * one.
 *
 * Set at module scope so it lands before the first paint — an effect would let
 * one light frame through on a device set to light. `global.css` carries a full
 * light palette behind `:root` and every screen is written against the same
 * variables, which is what made the Appearance control in Settings a matter of
 * calling `colorScheme.set` rather than a re-theme.
 *
 * `hydrateTheme` below is the second half: it reads the stored choice and
 * applies it a tick later, so someone who picked light gets one dark frame and
 * then their theme, and someone who never touched it gets this.
 */
colorScheme.set(DEFAULT_THEME);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const C = useTokens();
  const [fontsLoaded] = useFonts({
    // Urbanist is the whole voice now (2026-08-16). Static instances rather
    // than the variable TTF — RN maps fontFamily to a concrete face, so weight
    // axes don't resolve on Android.
    "Urbanist-Regular": require("@/assets/fonts/Urbanist-Regular.ttf"),
    "Urbanist-Medium": require("@/assets/fonts/Urbanist-Medium.ttf"),
    "Urbanist-SemiBold": require("@/assets/fonts/Urbanist-SemiBold.ttf"),
    "Urbanist-Bold": require("@/assets/fonts/Urbanist-Bold.ttf"),
    "Urbanist-ExtraBold": require("@/assets/fonts/Urbanist-ExtraBold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  // The stored Appearance choice, applied as soon as it can be read. It resolves
  // either way — a device with nothing stored is the ordinary case — so there is
  // nothing here to await or to fail.
  useEffect(() => {
    void hydrateTheme();
  }, []);

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
            {/* Inside the toast provider so a failed PIN can still surface
                one, and outside the navigator so the prompt survives route
                changes. */}
            <PinPromptProvider>
              <BottomSheetModalProvider>
                <StatusBar style="auto" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: C.canvas },
                  }}
                />
                {/* Both render nothing. `InactivityLock` closes the lock
                    once the app has been off screen long enough; `LockGate`
                    sends a locked app back to /unlock no matter which route a
                    deep link mounted. */}
                <InactivityLock />
                <LockGate />
                {/* Podcast playback is chrome, not a screen: minimised, the
                    bar rides over every route, which is only possible from
                    out here. It draws nothing until something is playing. */}
                <PlayerHost />
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
