import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { TakmicenjeDrillChromeBar } from '@/components/savez/takmicenje-drill-chrome-bar';
import { Colors } from '@/constants/theme';
import { TakmicenjeDrillChromeProvider } from '@/contexts/takmicenje-drill-chrome-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ANDROID_NAV_BAR =
  Platform.OS === 'android' ? ({ navigationBarColor: '#000000' } as const) : {};

export default function TakmicenjeLayout() {
  const scheme = useColorScheme() ?? 'light';
  const bg = Colors[scheme].background;

  return (
    <TakmicenjeDrillChromeProvider>
      <View style={styles.flex}>
        <TakmicenjeDrillChromeBar />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: bg, flex: 1 },
            ...ANDROID_NAV_BAR,
          }}
        />
      </View>
    </TakmicenjeDrillChromeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
