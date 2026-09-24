import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../lib/session";
import { Button, Loading, Notice, Screen, colors } from "../components/ui";
function Navigation() {
  const session = useSession();
  if (session.loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (session.error)
    return (
      <Screen>
        <Notice text={session.error} error />
        <Button title="Reconnect" onPress={() => void session.restore()} />
        <Button
          title="Sign out on this device"
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
        <Stack.Screen name="sign-in" options={{ title: "DENTpro" }} />
      </Stack.Protected>
    </Stack>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Navigation />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
