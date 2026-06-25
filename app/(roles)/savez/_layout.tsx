import { Tabs, usePathname } from 'expo-router';
import React, { useMemo } from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { tabNavigatorChromeOptions } from '@/lib/main-tab-chrome';
import { hideSavezMainTabChrome } from '@/lib/chrome-left-mode';

export default function SavezLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];
  const pathname = usePathname();
  const hideMainChrome = useMemo(() => hideSavezMainTabChrome(pathname), [pathname]);
  const base = tabNavigatorChromeOptions(c, {
    centerTitleForRoutes: new Set(['(takmicenje)', 'utakmice']),
  });

  return (
    <Tabs
      screenOptions={{
        ...base,
        headerShown: hideMainChrome ? false : base.headerShown,
        tabBarStyle: hideMainChrome ? { display: 'none' } : base.tabBarStyle,
      }}>
      <Tabs.Screen
        name="(takmicenje)"
        options={{
          title: 'Takmicenje',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="trophy.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="utakmice"
        options={{
          title: 'Utakmice',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="sportscourt.fill" color={color} />,
        }}
      />
      {/* Tab Korisnici — privremeno iskljucen; vrati blok ispod i ukloni sledecu liniju ako opet treba u tab baru.
      <Tabs.Screen
        name="korisnici"
        options={{
          title: 'Korisnici',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      */}
      <Tabs.Screen name="korisnici" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="dodaj-korisnika" options={{ href: null }} />
      <Tabs.Screen name="dodaj-utakmicu" options={{ href: null }} />
    </Tabs>
  );
}
