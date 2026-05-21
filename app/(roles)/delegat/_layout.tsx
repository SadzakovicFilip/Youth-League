import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { HeaderTitleOverrideProvider } from '@/contexts/header-title-override-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { tabNavigatorChromeOptions } from '@/lib/main-tab-chrome';

export default function DelegatLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];

  return (
    <HeaderTitleOverrideProvider>
      <Tabs
      screenOptions={tabNavigatorChromeOptions(c, {
        centerTitleForRoutes: new Set(['index', 'upravljaj-utakmicama', 'takmicenje']),
      })}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Moje lige',
          tabBarLabel: 'Moje lige',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="upravljaj-utakmicama"
        options={{
          title: 'Upravljaj utakmicama',
          tabBarLabel: 'Mečevi',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="takmicenje"
        options={{
          title: 'Takmičenje',
          tabBarLabel: 'Takmičenje',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="trophy.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="profil" options={{ href: null }} />
      <Tabs.Screen name="lige" options={{ href: null }} />
      <Tabs.Screen name="liga/[id]" options={{ href: null }} />
      <Tabs.Screen name="grupa/[id]" options={{ href: null }} />
      <Tabs.Screen name="klub/[id]" options={{ href: null }} />
      <Tabs.Screen name="korisnik/[id]" options={{ href: null }} />
      <Tabs.Screen name="sudija/[id]" options={{ href: null }} />
      <Tabs.Screen name="utakmice/[id]" options={{ href: null }} />
      <Tabs.Screen name="utakmica/[id]" options={{ href: null }} />
    </Tabs>
    </HeaderTitleOverrideProvider>
  );
}
