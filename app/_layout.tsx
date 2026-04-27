import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppSlideDrawer } from "@/components/app-slide-drawer";
import { Colors } from "@/constants/theme";
import { AppDrawerProvider } from "@/contexts/app-drawer-context";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { AuthHeaderProvider } from "@/contexts/auth-header-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { applyFixedAndroidNavigationBar } from "@/lib/android-navigation-bar";

export const unstable_settings = {
  anchor: "(tabs)",
};

/** Android: fiksna crna navigation bar (rn-screens inače uzme svetlu iz teme). */
const ANDROID_NAV_BAR_FIXED =
  Platform.OS === "android" ? ({ navigationBarColor: "#000000" } as const) : {};

/** Edge-to-edge (Android) + headerShown:false — insets moraju na root da svi stack ekrani budu ispod status bara. */
function RootSafeAreaFrame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.rootFrame,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {children}
    </View>
  );
}

function RootNavigation() {
  const scheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const run = () => void applyFixedAndroidNavigationBar();
    run();
    const id = requestAnimationFrame(run);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") run();
    });
    return () => {
      cancelAnimationFrame(id);
      sub.remove();
    };
  }, []);

  return (
    <>
      <StatusBar
        style={scheme === "dark" ? "light" : "dark"}
        backgroundColor={
          scheme === "dark" ? Colors.dark.background : Colors.light.background
        }
      />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Colors[scheme].background },
          ...ANDROID_NAV_BAR_FIXED,
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(roles)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
      <AppThemeProvider>
        <AuthHeaderProvider>
          <AppDrawerProvider>
            <>
              <RootSafeAreaFrame>
                <RootNavigation />
              </RootSafeAreaFrame>
              <AppSlideDrawer />
            </>
          </AppDrawerProvider>
        </AuthHeaderProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootFrame: { flex: 1 },
});
