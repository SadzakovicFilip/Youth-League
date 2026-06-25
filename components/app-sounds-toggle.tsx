import { Platform, StyleSheet, Switch, View } from 'react-native';

import { useAppFeedback } from '@/contexts/app-sounds-context';
import { triggerDrawerToggleFeedback } from '@/lib/app-feedback';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ThemedText } from '@/components/themed-text';

const drawerToggleTitleFont = Platform.select({
  ios: 'AvenirNext-DemiBold' as const,
  android: 'sans-serif-medium' as const,
  default: undefined,
});

export type AppSoundsToggleProps = {
  variant?: 'inline';
};

/** Prekidač zvukova aplikacije (pištaljka, koš, faul…). */
export function AppSoundsToggle({ variant = 'inline' }: AppSoundsToggleProps) {
  const { soundsEnabled, setSoundsEnabled } = useAppFeedback();
  const accent = useThemeColor({}, 'accent');

  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow} accessibilityRole="toolbar">
        <ThemedText style={[styles.inlineLabel, { fontFamily: drawerToggleTitleFont }]}>
          ZVUK
        </ThemedText>
        <Switch
          accessibilityLabel="Uključi ili isključi zvukove aplikacije"
          value={soundsEnabled}
          onValueChange={(v) => {
            triggerDrawerToggleFeedback();
            void setSoundsEnabled(v);
          }}
          trackColor={{ false: '#C8C8C8', true: accent }}
          thumbColor={soundsEnabled ? '#F4F4F4' : '#FFFFFF'}
          ios_backgroundColor="#C8C8C8"
        />
      </View>
    );
  }

  return null;
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
});
