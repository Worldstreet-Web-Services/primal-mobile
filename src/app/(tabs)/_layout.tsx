import { Tabs } from "expo-router";

import { PrimalTabBar } from "@/components/navigation/PrimalTabBar";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#0A0B0D" },
      }}
      tabBar={(props) => <PrimalTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio" }} />
      <Tabs.Screen name="pulse" options={{ title: "Pulse" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      {/* Lives in the tab navigator so the floating bar stays up, but owns no
          tab button of its own — reached from the home shelves. */}
      <Tabs.Screen name="copy-trading" options={{ href: null }} />
      <Tabs.Screen name="auto-earn" options={{ href: null }} />
    </Tabs>
  );
}
