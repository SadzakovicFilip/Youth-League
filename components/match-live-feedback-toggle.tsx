import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAppFeedback } from '@/contexts/app-sounds-context';
import { useAppTheme } from '@/contexts/app-theme-context';

const labelFont = Platform.select({
  ios: 'AvenirNext-DemiBold' as const,
  android: 'sans-serif-medium' as const,
  default: undefined,
});

type Props = {
  matchId: number;
};

/** Isključi zvuk + vibraciju samo za ovu utakmicu (live box score hero). */
export function MatchLiveFeedbackToggle({ matchId }: Props) {
  const { colors } = useAppTheme();
  const { isMatchFeedbackMuted, toggleMatchFeedbackMuted } = useAppFeedback();
  const muted = isMatchFeedbackMuted(matchId);

  return (
    <Pressable
      onPress={() => toggleMatchFeedbackMuted(matchId)}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: colors.borderStrong,
          backgroundColor: muted ? colors.surfaceMuted : 'transparent',
          opacity: pressed ? 0.75 : 1,
        },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: !muted }}
      accessibilityLabel={
        muted ? 'Uključi zvuk i vibraciju za ovu utakmicu' : 'Isključi zvuk i vibraciju za ovu utakmicu'
      }>
      <MaterialCommunityIcons
        name={muted ? 'volume-off' : 'volume-high'}
        size={18}
        color={muted ? colors.textMuted : colors.tint}
      />
      <ThemedText style={[styles.label, { color: colors.textSecondary, fontFamily: labelFont }]}>
        {muted ? 'ZVUK/VIBR. ISKLJ.' : 'ZVUK/VIBR. UKLJ.'}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
});
