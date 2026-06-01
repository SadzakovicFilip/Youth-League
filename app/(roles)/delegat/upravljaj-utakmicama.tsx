import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import {
  MatchRichCard,
  formatScore,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { MatchCalendarLegend } from '@/components/shared/match-calendar-legend';
import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import {
  formatMatchDisplayStatus,
  isMatchDisplayFinished,
} from '@/lib/match-display-status';

type MatchRow = {
  id: number;
  league_id: number;
  league_name: string | null;
  group_id: number | null;
  group_name: string | null;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  home_club_name: string | null;
  away_club_id: number;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  objection_marker?: 'none' | 'pending' | 'resolved' | string | null;
  display_status?: string | null;
};

type LeagueRow = {
  league_id: number;
  league_name: string;
};

function formatMatchTimeSr(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('sr-Latn', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function clubLabel(name: string | null, id: number): string {
  return name?.trim() ? name.trim() : `#${id}`;
}

function isMatchPlayed(m: MatchRow): boolean {
  return isMatchDisplayFinished(m);
}

function matchHeadline(m: MatchRow): string {
  return `${clubLabel(m.home_club_name, m.home_club_id)} — ${clubLabel(m.away_club_name, m.away_club_id)}`;
}

function leagueSublabel(m: MatchRow): string {
  const league = m.league_name?.trim() || `Liga #${m.league_id}`;
  return m.group_name?.trim() ? `${league} · ${m.group_name.trim()}` : league;
}

export default function DelegatUpravljajUtakmicamaScreen() {
  const { colors } = useAppTheme();
  const matchRichTheme = useMemo<MatchRichTheme>(
    () => ({
      surfaceMuted: colors.surfaceMuted,
      borderStrong: colors.borderStrong,
      tint: colors.tint,
      text: colors.text,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      danger: colors.danger,
    }),
    [colors],
  );

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [matches, setMatches] = useState<MatchRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data: leagueRows, error: leagueErr } = await supabase.rpc('get_delegate_leagues');
    if (leagueErr) {
      setErrorMessage(leagueErr.message);
      setMatches([]);
      setLoading(false);
      return;
    }

    const leagues = ((leagueRows ?? []) as LeagueRow[]) || [];
    if (leagues.length === 0) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const results = await Promise.all(
      leagues.map(async (L) => {
        const { data, error } = await supabase.rpc('get_league_matches', { p_league_id: L.league_id });
        return {
          league_id: L.league_id,
          league_name: L.league_name,
          matches: (data ?? []) as Omit<MatchRow, 'league_id' | 'league_name'>[],
          err: error?.message ?? null,
        };
      }),
    );

    const err = results.find((r) => r.err);
    if (err?.err) {
      setErrorMessage(err.err);
      setMatches([]);
      setLoading(false);
      return;
    }

    const merged: MatchRow[] = [];
    for (const r of results) {
      for (const m of r.matches) {
        merged.push({
          ...m,
          league_id: r.league_id,
          league_name: r.league_name,
        });
      }
    }
    setMatches(merged);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  const renderMatch = (m: MatchRow) => {
    const headline = matchHeadline(m);

    return (
      <View style={styles.matchBlock}>
        <ThemedText style={[styles.leagueTag, { color: colors.textSecondary }]}>
          {leagueSublabel(m)}
        </ThemedText>
        {isMatchPlayed(m) ? (
          <MatchRichCard
            variant="club_played"
            theme={matchRichTheme}
            oppName={headline}
            headline={headline}
            scheduledIso={m.scheduled_at}
            scoreLine={formatScore(m.home_score, m.away_score)}
            outcome={null}
          />
        ) : (
          <MatchRichCard
            variant="club_upcoming"
            theme={matchRichTheme}
            oppName={headline}
            headline={headline}
            scheduledIso={m.scheduled_at}
            venue={m.venue}
            status={formatMatchDisplayStatus(m)}
            homeScore={m.home_score}
            awayScore={m.away_score}
            matchTime={formatMatchTimeSr(m.scheduled_at)}
          />
        )}
      </View>
    );
  };

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {loading ? <ActivityIndicator color={colors.tint} /> : null}

      {errorMessage ? (
        <ThemedView style={[styles.errorCard, { borderColor: colors.borderStrong }]}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && matches.length === 0 ? (
        <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
          <ThemedText style={{ color: colors.textSecondary }}>
            Nema zakazanih utakmica u tvojim ligama.
          </ThemedText>
        </ThemedView>
      ) : null}

      {!loading && matches.length > 0 ? (
        <>
          <ThemedText type="subtitle" style={{ color: colors.text }}>
            Raspored utakmica
          </ThemedText>
          <MatchCalendarLegend />
          <MatchTimetableCalendar
            matches={matches}
            renderMatch={renderMatch}
            onMatchPress={(m) => router.push(`/delegat/utakmica/${m.id}` as never)}
          />
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12 },
  matchBlock: { gap: 6 },
  leagueTag: { fontSize: 12, fontWeight: '700', paddingHorizontal: 2 },
  errorCard: { borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  legendBlock: { gap: 6 },
  legendLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDotSample: { width: 8, height: 8, borderRadius: 4, marginLeft: 2 },
  legendBang: { width: 14, textAlign: 'center', fontWeight: '800', fontSize: 15, lineHeight: 16 },
  legend: { fontSize: 13, opacity: 0.9, flex: 1 },
});
