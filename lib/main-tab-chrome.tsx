import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { AppChromeHeader } from '@/components/app-chrome-header';
import { Colors } from '@/constants/theme';

type ColorSet = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** Zajednički header + tab bar stil za uloge sa Tabs navigatorom. */
export function tabNavigatorChromeOptions(c: ColorSet): BottomTabNavigationOptions {
  return {
    headerShown: true,
    header: () => <AppChromeHeader />,
    tabBarActiveTintColor: c.tint,
    tabBarInactiveTintColor: c.tabIconDefault,
    tabBarStyle: {
      backgroundColor: c.tabBar,
      borderTopColor: c.tabBarBorder,
    },
  };
}
