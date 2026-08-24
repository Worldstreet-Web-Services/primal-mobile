import { NativeTabs } from "expo-router/unstable-native-tabs";

import { F, useTokens } from "@/theme/tokens";

/**
 * The native tab bar mirrors `components/home/TabBar` — same four
 * destinations, same order, same outline-then-filled reading of the active
 * tab. It cannot mirror the glyphs literally: `NativeTabs.Trigger.Icon` hands
 * the platform an image, not a React element, so the `react-native-svg` marks
 * in `components/icons` are unusable here. Each trigger therefore names the
 * closest system symbol on both platforms.
 *
 * Colour follows the same three-state reading the JS bar uses, minus the dead
 * tabs: brand for where you are, `dim` for where you could go. `dim` rather
 * than `text` because a tab bar that shouts at full contrast competes with the
 * screen above it. Both come from `useTokens()`, not `C`, so the bar repaints
 * when the colour scheme flips instead of holding the palette it mounted with.
 */
const MainLayout = () => {
  const t = useTokens();

  return (
    <NativeTabs
      tintColor={t.brand}
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
  );
};

export default MainLayout;
