/**
 * Box score — samo čitanje (završena, uživo ili pre početka prema varianti).
 * Dva tima: horizontalni pager (domaćin ↔ gost), unutar stranice vertikalni scroll redova.
 */
import { ActionAccentHex, ActionAccentWash } from '@/constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAppTheme, type AppThemeColors } from '@/contexts/app-theme-context';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { MatchLiveFeedbackToggle } from '@/components/match-live-feedback-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type {
  MatchScorebookOfficial,
  MatchScorebookPayload,
  MatchScorebookRosterPlayer,
} from '@/components/match-scorebook-types';
import { boxScoreBadgeLabel, isMatchDisplayLive } from '@/lib/match-display-status';

function playerName(p: Pick<
  MatchScorebookRosterPlayer,
  'display_name' | 'first_name' | 'last_name' | 'username'
>) {
  return (
    p.display_name ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    p.username ||
    '—'
  );
}

function totalFromRoster(r: MatchScorebookRosterPlayer[]) {
  return r.reduce((s, p) => s + (p.total_points ?? 0), 0);
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('sr-Latn', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function officialName(o: MatchScorebookOfficial) {
  return (
    o.display_name ||
    [o.first_name, o.last_name].filter(Boolean).join(' ') ||
    o.username ||
    '—'
  );
}

function sortRoster(roster: MatchScorebookRosterPlayer[]) {
  return [...roster].sort((a, b) => {
    const d = (b.total_points ?? 0) - (a.total_points ?? 0);
    if (d !== 0) return d;
    return (a.jersey_number ?? 0) - (b.jersey_number ?? 0);
  });
}

export type MatchBoxScoreVariant = 'final' | 'live' | 'scheduled';

type Props = {
  data: MatchScorebookPayload;
  /** @deprecated Koristi se samo ako nema display_status na meču. */
  variant?: MatchBoxScoreVariant;
  /** Ispod hero kartice (npr. prigovor delegata), pre horizontalnog pager-a. */
  belowHero?: React.ReactNode;
};

function badgeLabelForData(data: MatchScorebookPayload, variant?: MatchBoxScoreVariant): string {
  if (data.match.display_status?.trim()) {
    return boxScoreBadgeLabel(data.match);
  }
  if (variant) {
    switch (variant) {
      case 'live':
        return 'UŽIVO · BOX SCORE';
      case 'scheduled':
        return 'ZAKAZANO · BOX SCORE';
      default:
        return 'ZAVRŠENO · BOX SCORE';
    }
  }
  return boxScoreBadgeLabel(data.match);
}

function RefereeSide({
  official,
  colors,
}: {
  official: MatchScorebookOfficial | undefined;
  colors: AppThemeColors;
}) {
  if (!official) return null;
  return (
    <View style={styles.refSide}>
      <MaterialCommunityIcons name="whistle" size={14} color={colors.textMuted} />
      <ThemedText style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
        {officialName(official)}
      </ThemedText>
    </View>
  );
}

function TeamTable({
  title,
  roster,
  colors,
}: {
  title: string;
  roster: MatchScorebookRosterPlayer[];
  colors: AppThemeColors;
}) {
  return (
    <ThemedView
      style={[styles.sectionCard, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
      <ThemedText type="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </ThemedText>
      {roster.length === 0 ? (
        <ThemedText style={{ color: colors.textSecondary }}>Nema evidencije sastava.</ThemedText>
      ) : (
        <>
          <View style={styles.tableHead}>
            <ThemedText style={[styles.th, styles.colNum, { color: colors.textMuted }]}>#</ThemedText>
            <ThemedText style={[styles.th, styles.colName, { color: colors.textMuted }]}>
              Igrač
            </ThemedText>
            <ThemedText style={[styles.th, styles.colStat, { color: colors.textMuted }]}>PTS</ThemedText>
            <ThemedText style={[styles.th, styles.colStat, { color: colors.textMuted }]}>+1</ThemedText>
            <ThemedText style={[styles.th, styles.colStat, { color: colors.textMuted }]}>+2</ThemedText>
            <ThemedText style={[styles.th, styles.colStat, { color: colors.textMuted }]}>+3</ThemedText>
            <ThemedText style={[styles.th, styles.colStat, { color: colors.textMuted }]}>PF</ThemedText>
          </View>
          {roster.map((p) => (
            <View
              key={p.user_id}
              style={[
                styles.tableRow,
                { borderTopColor: colors.border },
                p.fouls >= 5 && { opacity: 0.55 },
              ]}>
              <ThemedText style={[styles.td, styles.colNum, { color: colors.textSecondary }]}>
                {p.jersey_number}
              </ThemedText>
              <ThemedText style={[styles.td, styles.colName, { color: colors.text }]} numberOfLines={1}>
                {playerName(p)}
                {p.fouls >= 5 ? ' (OUT)' : ''}
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={[styles.td, styles.colStat, { color: colors.tint }]}>
                {p.total_points}
              </ThemedText>
              <ThemedText style={[styles.td, styles.colStat, { color: colors.textSecondary }]}>
                {p.pts_ft}
              </ThemedText>
              <ThemedText style={[styles.td, styles.colStat, { color: colors.textSecondary }]}>
                {p.pts_2}
              </ThemedText>
              <ThemedText style={[styles.td, styles.colStat, { color: colors.textSecondary }]}>
                {p.pts_3}
              </ThemedText>
              <ThemedText style={[styles.td, styles.colStat, { color: colors.textSecondary }]}>
                {p.fouls}
              </ThemedText>
            </View>
          ))}
        </>
      )}
    </ThemedView>
  );
}

export function MatchFinishedBoxScoreView({
  data,
  variant = 'final',
  belowHero = null,
}: Props) {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth;

  const m = data.match;
  const liveDisplay = isMatchDisplayLive(m) || variant === 'live';
  const homePts = totalFromRoster(data.home_roster);
  const awayPts = totalFromRoster(data.away_roster);
  const homeOfficial =
    liveDisplay ? homePts : m.home_score != null ? m.home_score : homePts;
  const awayOfficial =
    liveDisplay ? awayPts : m.away_score != null ? m.away_score : awayPts;

  const heroBorder =
    liveDisplay ? ActionAccentHex : colors.borderStrong;
  const heroBg =
    liveDisplay
      ? ActionAccentWash
      : variant === 'scheduled'
        ? colors.surface
        : colors.surfaceMuted;

  const homeTitle = m.home_club_name ?? 'Domaćin';
  const awayTitle = m.away_club_name ?? 'Gost';
  const sudije = data.sudije ?? [];
  const sudija1 = sudije[0];
  const sudija2 = sudije[1];
  const showMeta = Boolean(m.scheduled_at || m.venue?.trim() || sudija1 || sudija2);

  return (
    <View style={styles.screen}>
      <View style={styles.main}>
        <View style={styles.topPad}>
          <ThemedView
            style={[
              styles.heroCard,
              { borderColor: heroBorder, backgroundColor: heroBg },
            ]}>
            <ThemedText
              style={[styles.badge, { color: colors.textSecondary, borderColor: colors.borderStrong }]}>
              {badgeLabelForData(data, variant)}
            </ThemedText>
            <View style={styles.scoreRow}>
              <View style={styles.teamCol}>
                <ThemedText style={[styles.clubLine, { color: colors.text }]} numberOfLines={2}>
                  {homeTitle}
                </ThemedText>
                <ThemedText style={[styles.bigScore, { color: colors.tint }]}>{homeOfficial}</ThemedText>
              </View>
              <ThemedText style={[styles.vsMid, { color: colors.textMuted }]}>—</ThemedText>
              <View style={[styles.teamCol, styles.teamColAway]}>
                <ThemedText
                  style={[styles.clubLine, styles.clubLineAway, { color: colors.text }]}
                  numberOfLines={2}>
                  {awayTitle}
                </ThemedText>
                <ThemedText style={[styles.bigScore, { color: colors.tint }]}>{awayOfficial}</ThemedText>
              </View>
            </View>
            {showMeta ? (
              <View style={styles.metaBlock}>
                {m.scheduled_at || sudija1 ? (
                  <View style={styles.metaRow}>
                    {m.scheduled_at ? (
                      <ThemedText
                        style={[styles.meta, styles.metaLeft, { color: colors.textSecondary }]}
                        numberOfLines={2}>
                        Termin: {formatWhen(m.scheduled_at)}
                      </ThemedText>
                    ) : (
                      <View style={styles.metaLeft} />
                    )}
                    <RefereeSide official={sudija1} colors={colors} />
                  </View>
                ) : null}
                {m.venue?.trim() || sudija2 ? (
                  <View style={styles.metaRow}>
                    {m.venue?.trim() ? (
                      <ThemedText
                        style={[styles.meta, styles.metaLeft, { color: colors.textSecondary }]}
                        numberOfLines={2}>
                        {m.venue.trim()}
                      </ThemedText>
                    ) : (
                      <View style={styles.metaLeft} />
                    )}
                    <RefereeSide official={sudija2} colors={colors} />
                  </View>
                ) : null}
              </View>
            ) : null}
            {liveDisplay ? <MatchLiveFeedbackToggle matchId={m.id} /> : null}
          </ThemedView>

          {belowHero}

          <ThemedView style={styles.teamBar}>
            <ThemedText style={[styles.swipeHint, { color: colors.textMuted }]} numberOfLines={2}>
              Prevucite ulevo za gosta, udesno za domaćina
            </ThemedText>
          </ThemedView>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.pager}>
          <View style={[styles.page, { width: pageWidth }]}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pageContent}
              showsVerticalScrollIndicator>
              <TeamTable
                title={homeTitle}
                roster={sortRoster(data.home_roster)}
                colors={colors}
              />
            </ScrollView>
          </View>
          <View style={[styles.page, { width: pageWidth }]}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pageContent}
              showsVerticalScrollIndicator>
              <TeamTable
                title={awayTitle}
                roster={sortRoster(data.away_roster)}
                colors={colors}
              />
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  main: { flex: 1 },
  topPad: { paddingHorizontal: 8, paddingTop: 4, gap: 8 },
  pager: { flex: 1 },
  page: { flex: 1 },
  pageContent: { paddingHorizontal: 8, paddingBottom: 28 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamCol: { flex: 1, gap: 4 },
  teamColAway: { alignItems: 'flex-end' },
  clubLine: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'left',
  },
  clubLineAway: { textAlign: 'right' },
  bigScore: { fontSize: 36, fontWeight: '900', lineHeight: 42 },
  vsMid: { fontSize: 22, paddingTop: 18, fontWeight: '600' },
  metaBlock: { gap: 6 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLeft: { flex: 1, minWidth: 0 },
  meta: { fontSize: 12 },
  refSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '46%',
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  teamBar: { paddingHorizontal: 2 },
  swipeHint: { fontSize: 11 },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 6,
  },
  sectionTitle: { marginBottom: 2 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  th: { fontSize: 10, fontWeight: '800' },
  td: { fontSize: 12 },
  colNum: { width: 22, textAlign: 'center' },
  colName: { flex: 1, minWidth: 0 },
  colStat: { width: 28, textAlign: 'center' },
});
