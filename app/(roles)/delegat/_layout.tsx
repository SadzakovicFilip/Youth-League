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
          centerTitleForRoutes: new Set(['upravljaj-utakmicama', 'takmicenje', 'sudije']),
        })}>
        <Tabs.Screen
          name="upravljaj-utakmicama"
          options={{
            title: 'Utakmice',
            tabBarLabel: 'Utakmice',
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
        <Tabs.Screen
          name="sudije"
          options={{
            title: 'Sudije',
            tabBarLabel: 'Sudije',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.3.fill" color={color} />,
          }}
        />
        <Tabs.Screen name="index" options={{ href: null }} />
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
