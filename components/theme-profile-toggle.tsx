import { Platform, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useThemeColor } from '@/hooks/use-theme-color';

const drawerToggleTitleFont = Platform.select({
  ios: 'AvenirNext-DemiBold' as const,
  android: 'sans-serif-medium' as const,
  default: undefined,
});
const drawerToggleHintFont = Platform.select({
  ios: 'AvenirNext-Regular' as const,
  android: 'sans-serif' as const,
  default: undefined,
});

export type ThemeProfileToggleProps = {
  /**
   * `plain` — bez okvira/kartice (npr. bočni drawer, jedan blok sa ostatkom sadržaja).
   * `inline` — samo „TEMA“ + prekidač u jednom redu (drawer vrh).
   * @default 'card'
   */
  variant?: 'card' | 'plain' | 'inline';
  /** Veći, „tabloidski“ tekst (npr. drawer `plain`). */
  prominent?: boolean;
};

/**
 * Prekidac svetla / tamna tema — staviti u ekran Profil (ili podesavanja naloga).
 */
export function ThemeProfileToggle({ variant = 'card', prominent }: ThemeProfileToggleProps) {
  const { colorScheme, setColorScheme } = useAppTheme();
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const accent = useThemeColor({}, 'accent');
  const isDark = colorScheme === 'dark';

  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow} accessibilityRole="toolbar">
        <ThemedText
          style={[
            styles.inlineLabel,
            { fontFamily: drawerToggleTitleFont },
          ]}>
          TEMA
        </ThemedText>
        <Switch
          accessibilityLabel="Prebaci tamnu temu"
          value={isDark}
          onValueChange={(v) => void setColorScheme(v ? 'dark' : 'light')}
          trackColor={{ false: '#C8C8C8', true: accent }}
          thumbColor={isDark ? '#F4F4F4' : '#FFFFFF'}
          ios_backgroundColor="#C8C8C8"
        />
      </View>
    );
  }

  const titleStyle =
    variant === 'plain' && prominent
      ? [styles.titlePlainProminent, { fontFamily: drawerToggleTitleFont }]
      : undefined;
  const hintStyle =
    variant === 'plain' && prominent
      ? [styles.hintPlainProminent, { fontFamily: drawerToggleHintFont }]
      : styles.hint;

  const row = (
    <View style={styles.row}>
      <View style={styles.labels}>
        <ThemedText type="defaultSemiBold" style={titleStyle}>
          Tema aplikacije
        </ThemedText>
        <ThemedText style={hintStyle}>{isDark ? 'Tamna' : 'Svetla'}</ThemedText>
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
  );

  if (variant === 'plain') {
    return <View style={styles.plainOuter}>{row}</View>;
  }

  return (
    <ThemedView style={[styles.card, { borderColor: border, backgroundColor: surface }]}>
      {row}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  inlineLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  plainOuter: {
    width: '100%',
    paddingVertical: 4,
  },
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
  labels: { flex: 1, gap: 6 },
  hint: { opacity: 0.75, fontSize: 14 },
  titlePlainProminent: { fontSize: 19, fontWeight: '700', letterSpacing: 0.2 },
  hintPlainProminent: { opacity: 0.82, fontSize: 16, marginTop: 2 },
});
