import { Stack } from "expo-router";
import { View } from "react-native";
import { colors, fonts } from "../../components/ui";
import { PatientNav } from "../../components/patient-nav";
export default function PatientLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack
        screenOptions={{
          headerTintColor: colors.blue,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 16 },
          headerStyle: { backgroundColor: colors.paper },
          headerShadowVisible: false,
          headerBackTitle: "Geri",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="new" options={{ title: "Yeni vaka" }} />
        <Stack.Screen name="case/[id]" options={{ title: "Vakanız" }} />
        <Stack.Screen name="share/[id]" options={{ title: "Klinik seçin" }} />
        <Stack.Screen
          name="clinic/[id]"
          options={{ title: "Klinik bilgileri" }}
        />
        <Stack.Screen
          name="proposal/[id]"
          options={{ title: "Klinik teklifi" }}
        />
        <Stack.Screen
          name="compare/[id]"
          options={{ title: "Teklifleri karşılaştır" }}
        />
      </Stack>
      <PatientNav />
    </View>
  );
}
