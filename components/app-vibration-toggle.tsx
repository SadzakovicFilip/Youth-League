import { Platform, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppFeedback } from '@/contexts/app-sounds-context';
import { triggerDrawerToggleFeedback } from '@/lib/app-feedback';
import { useThemeColor } from '@/hooks/use-theme-color';

const drawerToggleTitleFont = Platform.select({
  ios: 'AvenirNext-DemiBold' as const,
  android: 'sans-serif-medium' as const,
  default: undefined,
});

export type AppVibrationToggleProps = {
  variant?: 'inline';
};

export function AppVibrationToggle({ variant = 'inline' }: AppVibrationToggleProps) {
  const { vibrationEnabled, setVibrationEnabled } = useAppFeedback();
  const accent = useThemeColor({}, 'accent');

  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow} accessibilityRole="toolbar">
        <ThemedText style={[styles.inlineLabel, { fontFamily: drawerToggleTitleFont }]}>
          VIBRACIJA
        </ThemedText>
        <Switch
          accessibilityLabel="Uključi ili isključi vibraciju aplikacije"
          value={vibrationEnabled}
          onValueChange={(v) => {
            triggerDrawerToggleFeedback();
            void setVibrationEnabled(v);
          }}
          trackColor={{ false: '#C8C8C8', true: accent }}
          thumbColor={vibrationEnabled ? '#F4F4F4' : '#FFFFFF'}
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
