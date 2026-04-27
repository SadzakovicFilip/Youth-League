import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TrenerLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Treninzi',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Utakmice',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="paperplane.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="tim" options={{ href: null }} />
      <Tabs.Screen name="treninzi" options={{ href: null }} />
      <Tabs.Screen name="taktike" options={{ href: null }} />
      <Tabs.Screen name="clanarine" options={{ href: null }} />
      <Tabs.Screen name="dodaj-igraca" options={{ href: null }} />
      <Tabs.Screen name="moja-liga" options={{ href: null }} />
      <Tabs.Screen name="takmicenje" options={{ href: null }} />
      <Tabs.Screen name="klub/[id]" options={{ href: null }} />
      <Tabs.Screen name="korisnik/[id]" options={{ href: null }} />
      <Tabs.Screen name="utakmica/[id]" options={{ href: null }} />
      <Tabs.Screen name="trening/[id]" options={{ href: null }} />
      <Tabs.Screen name="taktika/[id]" options={{ href: null }} />
    </Tabs>
  );
}
