import { Stack } from "expo-router";
import { colors } from "../../components/ui";
export default function PatientLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: "New case" }} />
      <Stack.Screen name="case/[id]" options={{ title: "Your case" }} />
      <Stack.Screen name="share/[id]" options={{ title: "Choose clinics" }} />
      <Stack.Screen
        name="proposal/[id]"
        options={{ title: "Clinic proposal" }}
      />
      <Stack.Screen
        name="compare/[id]"
        options={{ title: "Compare proposals" }}
      />
    </Stack>
  );
}
