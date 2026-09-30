import { useFonts } from "expo-font";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../lib/session";
import { Button, LoadingBrand, Notice, Screen, colors } from "../components/ui";
function Navigation() {
  const session = useSession();
  if (session.loading)
    return (
      <Screen topInset contentStyle={{ flexGrow: 1 }}>
        <LoadingBrand />
      </Screen>
    );
  if (session.error)
    return (
      <Screen>
        <Notice text={session.error} error />
        <Button title="Yeniden bağlan" onPress={() => void session.restore()} />
        <Button
          title="Bu cihazda çıkış yap"
          secondary
          onPress={() => void session.expire()}
        />
      </Screen>
    );
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.paper },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.paper },
      }}
    >
      <Stack.Protected guard={!!session.token}>
        <Stack.Screen name="(patient)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!session.token}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen
          name="forgot-password"
          options={{ title: "Şifre yenileme" }}
        />
      </Stack.Protected>
    </Stack>
  );
}
export default function Root() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!fontsLoaded && !fontError)
    return (
      <SafeAreaProvider>
        <Screen topInset contentStyle={{ flexGrow: 1 }}>
          <LoadingBrand />
        </Screen>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Navigation />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
