import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Prekidac svetla / tamna tema — staviti u ekran Profil (ili podesavanja naloga).
 */
export function ThemeProfileToggle() {
  const { colorScheme, setColorScheme } = useAppTheme();
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const accent = useThemeColor({}, 'accent');
  const isDark = colorScheme === 'dark';

  return (
    <ThemedView style={[styles.card, { borderColor: border, backgroundColor: surface }]}>
      <View style={styles.row}>
        <View style={styles.labels}>
          <ThemedText type="defaultSemiBold">Tema aplikacije</ThemedText>
          <ThemedText style={styles.hint}>{isDark ? 'Tamna' : 'Svetla'}</ThemedText>
        </View>
        <Switch
          accessibilityLabel="Prebaci tamnu temu"
          value={isDark}
          onValueChange={(v) => void setColorScheme(v ? 'dark' : 'light')}
          trackColor={{ false: '#C8C8C8', true: accent }}
          thumbColor={isDark ? '#F4F4F4' : '#FFFFFF'}
          ios_backgroundColor="#C8C8C8"
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labels: { flex: 1, gap: 4 },
  hint: { opacity: 0.75, fontSize: 14 },
});
