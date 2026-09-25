import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand, colors, fonts } from "../../../components/ui";
export default function TabLayout() {
  const insets = useSafeAreaInsets();
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
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: "white",
          paddingTop: 10,
          height: 72 + Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 11,
          marginTop: 5,
        },
      }}
    >
      {(
        [
          { name: "index", title: "Home", icon: "home-outline" },
          { name: "appointments", title: "Requests", icon: "calendar-outline" },
          { name: "profile", title: "Profile", icon: "person-outline" },
        ] as const
      ).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            ...(tab.name === "index" ? { headerTitle: () => <Brand /> } : {}),
            tabBarIcon: ({ focused, color }) => (
              <View
                style={{
                  width: 44,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: focused ? colors.blue : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons
                  name={tab.icon}
                  color={focused ? "white" : color}
                  size={22}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
