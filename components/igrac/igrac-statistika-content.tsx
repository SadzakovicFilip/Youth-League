import { StyleSheet } from 'react-native';

import { PlayerStatsSection } from '@/components/shared/player-stats-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';

import { IgracScreenState } from './igrac-screen-state';

export function IgracStatistikaContent({ embedded = false }: { embedded?: boolean }) {
  const { colors } = useAppTheme();
  const { loading, errorMessage, data } = useIgracDashboard();
  const matchHub = data?.match_hub ?? null;

  return (
    <>
      {!embedded ? (
        <ThemedText type="subtitle" style={{ color: colors.text }}>
          Statistika
        </ThemedText>
      ) : null}

      <IgracScreenState loading={loading} errorMessage={errorMessage} />

      {!loading && !errorMessage ? (
        !matchHub?.club_id ? (
          <ThemedView style={[styles.empty, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>
              Nisi u klubu kao igrač ili statistika nije dostupna.
            </ThemedText>
          </ThemedView>
        ) : (
          <PlayerStatsSection season={matchHub.season} career={matchHub.career} />
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  empty: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
});
