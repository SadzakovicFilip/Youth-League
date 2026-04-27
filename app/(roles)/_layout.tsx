import { Stack } from "expo-router";
import { Platform } from "react-native";

import { AppChromeHeader } from "@/components/app-chrome-header";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const TAB_LAYOUT_ROUTES = new Set(["trener", "klub", "savez"]);

function isTabLayoutStackScreen(routeName: string) {
  if (TAB_LAYOUT_ROUTES.has(routeName)) return true;
  const root = routeName.split("/")[0] ?? "";
  return TAB_LAYOUT_ROUTES.has(root);
}

export default function RolesGroupLayout() {
  const scheme = useColorScheme() ?? "light";
  const c = Colors[scheme];
  const androidNavBarFixed =
    Platform.OS === "android" ? ({ navigationBarColor: "#000000" } as const) : {};

  return (
    <Stack
      screenOptions={({ route }) => {
        const name = route.name;
        if (isTabLayoutStackScreen(name)) {
          return {
            headerShown: false,
            contentStyle: { backgroundColor: c.background },
            ...androidNavBarFixed,
          };
        }
        return {
          headerShown: true,
          header: () => <AppChromeHeader />,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
          ...androidNavBarFixed,
        };
      }}
    />
  );
}
