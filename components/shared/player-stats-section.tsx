import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ActionAccentWash } from '@/constants/theme';
import { useAppTheme } from '@/contexts/app-theme-context';

export type PlayerStatsAgg = {
  games_played: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  pct_points_ft: number;
  pct_points_2: number;
  pct_points_3: number;
};

type AggCardProps = {
  label: string;
  agg: PlayerStatsAgg | undefined;
};

export function PlayerStatsAggCard({ label, agg }: AggCardProps) {
  const { colors } = useAppTheme();
  const games = agg?.games_played ?? 0;
  const pts = agg?.total_points ?? 0;
  const avg = agg?.avg_points ?? 0;
  const ft = Math.max(0, agg?.pct_points_ft ?? 0);
  const p2 = Math.max(0, agg?.pct_points_2 ?? 0);
  const p3 = Math.max(0, agg?.pct_points_3 ?? 0);
  const shotSum = ft + p2 + p3;

  return (
    <ThemedView
      style={[
        styles.statsAggCard,
        { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
      ]}>
      <View style={styles.statsAggHeader}>
        <MaterialIcons name="sports-basketball" size={22} color={colors.tint} />
        <ThemedText type="defaultSemiBold" style={[styles.statsAggTitle, { color: colors.text }]}>
          {label}
        </ThemedText>
        <View
          style={[
            styles.statsGamesPill,
            { backgroundColor: ActionAccentWash, borderColor: colors.tint },
          ]}>
          <ThemedText style={[styles.statsGamesPillText, { color: colors.tint }]}>
            {games} mečeva
          </ThemedText>
        </View>
      </View>
      <View style={styles.statsHeroRow}>
        <View>
          <ThemedText style={[styles.statsHeroLabel, { color: colors.textSecondary }]}>
            Prosek PTS
          </ThemedText>
          <ThemedText style={[styles.statsHeroValue, { color: colors.text }]}>
            {avg.toFixed(1)}
          </ThemedText>
        </View>
        <View style={[styles.statsHeroDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsHeroRight}>
          <ThemedText style={[styles.statsHeroLabel, { color: colors.textSecondary }]}>
            Ukupno poena
          </ThemedText>
          <ThemedText style={[styles.statsHeroValue, { color: colors.tint }]}>{pts}</ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.statsSectionLabel, { color: colors.textSecondary }]}>
        Udeo poena (+1 / +2 / +3)
      </ThemedText>
      <View style={[styles.statsShotBar, { backgroundColor: colors.border }]}>
        {shotSum <= 0 ? (
          <View style={{ flex: 1, minHeight: 10, backgroundColor: colors.surfaceMuted }} />
        ) : (
          <>
            <View
              style={{
                flex: ft,
                backgroundColor: colors.tint,
                minWidth: ft > 0.5 ? 3 : 0,
              }}
            />
            <View
              style={{
                flex: p2,
                backgroundColor: '#C45C2A',
                minWidth: p2 > 0.5 ? 3 : 0,
              }}
            />
            <View
              style={{
                flex: p3,
                backgroundColor: colors.textMuted,
                minWidth: p3 > 0.5 ? 3 : 0,
              }}
            />
          </>
        )}
      </View>
      <View style={styles.statsShotLegend}>
        <ThemedText style={[styles.statsLegendItem, { color: colors.textSecondary }]}>
          +1 {ft.toFixed(0)}%
        </ThemedText>
        <ThemedText style={[styles.statsLegendItem, { color: colors.textSecondary }]}>
          +2 {p2.toFixed(0)}%
        </ThemedText>
        <ThemedText style={[styles.statsLegendItem, { color: colors.textSecondary }]}>
          +3 {p3.toFixed(0)}%
        </ThemedText>
      </View>
      <View style={[styles.statsMiniRow, { borderTopColor: colors.border }]}>
        <View style={styles.statsMiniCell}>
          <MaterialIcons name="looks-one" size={16} color={colors.tint} />
          <ThemedText style={[styles.statsMiniVal, { color: colors.text }]}>{agg?.pts_ft ?? 0}</ThemedText>
          <ThemedText style={[styles.statsMiniLbl, { color: colors.textMuted }]}>+1</ThemedText>
        </View>
        <View style={styles.statsMiniCell}>
          <MaterialIcons name="looks-two" size={16} color={colors.tint} />
          <ThemedText style={[styles.statsMiniVal, { color: colors.text }]}>{agg?.pts_2 ?? 0}</ThemedText>
          <ThemedText style={[styles.statsMiniLbl, { color: colors.textMuted }]}>+2</ThemedText>
        </View>
        <View style={styles.statsMiniCell}>
          <MaterialIcons name="looks-3" size={16} color={colors.tint} />
          <ThemedText style={[styles.statsMiniVal, { color: colors.text }]}>{agg?.pts_3 ?? 0}</ThemedText>
          <ThemedText style={[styles.statsMiniLbl, { color: colors.textMuted }]}>+3</ThemedText>
        </View>
      </View>
      <View style={[styles.statsFoulRow, { borderTopColor: colors.border }]}>
        <MaterialIcons name="gavel" size={18} color={colors.danger} />
        <ThemedText style={[styles.statsFoulLabel, { color: colors.text }]}>Lične greške</ThemedText>
        <ThemedText style={[styles.statsFoulVal, { color: colors.danger }]}>{agg?.fouls ?? 0}</ThemedText>
      </View>
    </ThemedView>
  );
}

type SectionProps = {
  season: PlayerStatsAgg | undefined;
  career: PlayerStatsAgg | undefined;
  seasonLabel?: string;
  careerLabel?: string;
};

export function PlayerStatsSection({
  season,
  career,
  seasonLabel = 'Sezona (liga)',
  careerLabel = 'Karijera',
}: SectionProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.statsSection}>
      <View style={styles.statsSectionHeader}>
        <MaterialIcons name="leaderboard" size={22} color={colors.tint} />
        <ThemedText type="defaultSemiBold" style={{ color: colors.text, flex: 1 }}>
          Statistika
        </ThemedText>
      </View>
      <PlayerStatsAggCard label={seasonLabel} agg={season} />
      <PlayerStatsAggCard label={careerLabel} agg={career} />
    </View>
  );
}

const styles = StyleSheet.create({
  statsSection: { gap: 12 },
  statsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  statsAggCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  statsAggHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsAggTitle: { flex: 1, fontSize: 16 },
  statsGamesPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statsGamesPillText: { fontSize: 11, fontWeight: '800' },
  statsHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  statsHeroLabel: { fontSize: 12, marginBottom: 2 },
  statsHeroValue: { fontSize: 28, fontWeight: '800' },
  statsHeroDivider: { width: 1, height: 44, marginHorizontal: 12 },
  statsHeroRight: { alignItems: 'flex-end' },
  statsSectionLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statsShotBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  statsShotLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  statsLegendItem: { fontSize: 11, fontWeight: '600' },
  statsMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  statsMiniCell: { alignItems: 'center', gap: 2 },
  statsMiniVal: { fontSize: 17, fontWeight: '800' },
  statsMiniLbl: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  statsFoulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  statsFoulLabel: { flex: 1, fontWeight: '600', fontSize: 14 },
  statsFoulVal: { fontSize: 20, fontWeight: '800' },
});
