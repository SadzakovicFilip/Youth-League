import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { HeaderTitleOverrideProvider } from '@/contexts/header-title-override-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { tabNavigatorChromeOptions } from '@/lib/main-tab-chrome';

export default function KlubLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];

  return (
    <HeaderTitleOverrideProvider>
      <Tabs
        screenOptions={tabNavigatorChromeOptions(c, {
          centerTitleForRoutes: new Set(['index', 'tim', 'utakmice', 'takmicenje']),
        })}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Upravljanje klubom',
          tabBarLabel: 'Klub',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tim"
        options={{
          title: 'Tim i članarine',
          tabBarLabel: 'Tim',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="utakmice"
        options={{
          title: 'Utakmice',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="takmicenje"
        options={{
          title: 'Takmičenje',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="trophy.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="dodaj-igraca" options={{ href: null }} />
      <Tabs.Screen name="dodaj-trenera" options={{ href: null }} />
      <Tabs.Screen name="dodaj-zapisnicara" options={{ href: null }} />
      <Tabs.Screen name="moja-liga" options={{ href: null }} />
      <Tabs.Screen name="klub/[id]" options={{ href: null }} />
      <Tabs.Screen name="korisnik/[id]" options={{ href: null }} />
      <Tabs.Screen name="utakmica/[id]" options={{ href: null }} />
    </Tabs>
    </HeaderTitleOverrideProvider>
  );
}
