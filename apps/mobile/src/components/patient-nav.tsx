import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts } from "./ui";

const destinations = [
  {
    label: "Ana Sayfa",
    href: "/(patient)/(tabs)",
    icon: "home-outline",
    selectedIcon: "home",
  },
  {
    label: "Talepler",
    href: "/appointments",
    icon: "calendar-outline",
    selectedIcon: "calendar",
  },
  {
    label: "Profil",
    href: "/profile",
    icon: "person-outline",
    selectedIcon: "person",
  },
] as const;

export function PatientNav() {
  const pathname = usePathname();
  const current =
    pathname === "/profile"
      ? "Profil"
      : pathname === "/appointments"
        ? "Talepler"
        : "Ana Sayfa";

  return (
    <SafeAreaView edges={["bottom"]} style={styles.bar}>
      <View style={styles.row}>
        {destinations.map((destination) => {
          const selected = current === destination.label;
          return (
            <Pressable
              key={destination.label}
              accessibilityRole="tab"
              accessibilityLabel={destination.label}
              accessibilityState={{ selected }}
              onPress={() => router.navigate(destination.href)}
              style={styles.item}
            >
              <Ionicons
                name={selected ? destination.selectedIcon : destination.icon}
                size={22}
                color={selected ? colors.blue : colors.muted}
              />
              <Text style={[styles.label, selected && styles.selectedLabel]}>
                {destination.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: { flexDirection: "row", paddingTop: 6 },
  item: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 },
  selectedLabel: { color: colors.blue, fontFamily: fonts.semibold },
});
