import { NativeTabs } from "expo-router/unstable-native-tabs";

import { F, useTokens } from "@/theme/tokens";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";

const MainLayout = () => {
  const t = useTokens();
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <NativeTabs
        // tintColor={t.brand}
        iconColor={{ default: t.dim, selected: t.brand }}
        labelStyle={{
          default: { color: t.dim, fontFamily: F.body },
          selected: { color: t.brand, fontFamily: F.bodySemibold },
        }}
        indicatorColor={t.brandGlow}
      >
        <NativeTabs.Trigger name="home">
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "house", selected: "house.fill" }}
            md={{ default: "home", selected: "home_filled" }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="news">
          <NativeTabs.Trigger.Label>News</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "newspaper", selected: "newspaper.fill" }}
            md="newspaper"
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="podcast">
          <NativeTabs.Trigger.Label>Podcast</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "mic", selected: "mic.fill" }}
            md={{ default: "mic_none", selected: "mic" }}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: "gearshape", selected: "gearshape.fill" }}
            md="settings"
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </ThemeProvider>
  );
};

export default MainLayout;
