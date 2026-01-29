import "react-native-gesture-handler";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SafeAreaProvider } from "react-native-safe-area-context";
import { TimerSessionGuard } from "../components/TimerSessionGuard";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <TimerSessionGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
