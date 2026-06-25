import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { IgracDashboardProvider } from '@/contexts/igrac-dashboard-context';
import { HeaderTitleOverrideProvider } from '@/contexts/header-title-override-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { tabNavigatorChromeOptions } from '@/lib/main-tab-chrome';
import { armTrainingTabPressSound } from '@/lib/app-feedback';

export default function IgracLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const c = Colors[colorScheme];

  return (
    <IgracDashboardProvider>
      <HeaderTitleOverrideProvider>
        <Tabs
          screenOptions={tabNavigatorChromeOptions(c, {
            centerTitleForRoutes: new Set(['index', 'utakmice', 'takmicenje', 'profil']),
          })}>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Treninzi i taktike',
              tabBarLabel: 'Treninzi',
              tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
            }}
            listeners={{
              tabPress: () => armTrainingTabPressSound(),
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
              title: 'Liga',
              tabBarLabel: 'Liga',
              tabBarIcon: ({ color }) => <IconSymbol size={24} name="trophy.fill" color={color} />,
            }}
          />
          <Tabs.Screen
            name="profil"
            options={{
              title: 'Profil',
              tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
            }}
          />
          <Tabs.Screen name="klub/[id]" options={{ href: null }} />
          <Tabs.Screen name="korisnik/[id]" options={{ href: null }} />
          <Tabs.Screen name="utakmica/[id]" options={{ href: null }} />
          <Tabs.Screen name="taktika/[id]" options={{ href: null }} />
        </Tabs>
      </HeaderTitleOverrideProvider>
    </IgracDashboardProvider>
  );
}
