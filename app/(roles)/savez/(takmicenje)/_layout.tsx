import { Stack } from "expo-router";
import { Platform } from "react-native";

const ANDROID_NAV_BAR =
  Platform.OS === "android" ? ({ navigationBarColor: "#000000" } as const) : {};

export default function TakmicenjeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...ANDROID_NAV_BAR,
      }}
    />
  );
}
