import { Tabs } from "expo-router";
import { Brand, colors, fonts } from "../../../components/ui";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.paper },
        headerTitleAlign: "center",
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { display: "none" },
      }}
    >
      {(
        [
          { name: "index", title: "Ana Sayfa" },
          { name: "appointments", title: "Talepler" },
          { name: "profile", title: "Profil" },
        ] as const
      ).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            ...(tab.name === "index" ? { headerTitle: () => <Brand /> } : {}),
          }}
        />
      ))}
    </Tabs>
  );
}
