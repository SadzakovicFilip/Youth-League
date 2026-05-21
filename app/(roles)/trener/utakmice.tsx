import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import {
  MatchRichCard,
  formatScore,
  playedOutcomeLetter,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

const ROSTER_SIZE = 12;

type MatchRow = {
  id: number;
  league_id: number;
  group_id: number | null;
  home_club_id: number;
  away_club_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  home_club_name: string | null;
  away_club_name: string | null;
  side: 'home' | 'away';
  phase: 'upcoming' | 'played' | 'past';
  roster_count: number;
};

type Payload = {
  context: {
    club_id: number;
    club_name: string;
    league_id: number | null;
    league_name: string | null;
    group_id: number | null;
    group_name: string | null;
  } | null;
  upcoming: MatchRow[];
  all: MatchRow[];
};

function matchNeedsRoster(m: MatchRow): boolean {
  return m.phase === 'upcoming' && m.roster_count < ROSTER_SIZE;
}

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

export default function TrenerUtakmiceScreen() {
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
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data: rpcData, error } = await supabase.rpc('get_trener_matches', { p_club_id: null });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    setData(rpcData as Payload);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  const renderMatch = (m: MatchRow) => {
    const opponent =
      m.side === 'home' ? m.away_club_name ?? null : m.home_club_name ?? null;
    const oppLabel = opponent?.trim() ? opponent.trim() : '—';
    const statusLabel = (m.status ?? '').trim() || '—';
    const timeStr = formatMatchTimeSr(m.scheduled_at);
    const playedLike = m.phase === 'played' || m.phase === 'past';

    if (playedLike) {
      const scoreLine = formatScore(m.home_score, m.away_score);
      const outcome = playedOutcomeLetter(
        m.side,
        m.home_score,
        m.away_score,
        null,
      );
      return (
        <MatchRichCard
          variant="club_played"
          theme={matchRichTheme}
          oppName={oppLabel}
          scheduledIso={m.scheduled_at}
          scoreLine={scoreLine}
          outcome={outcome}
        />
      );
    }

    return (
      <MatchRichCard
        variant="club_upcoming"
        theme={matchRichTheme}
        oppName={oppLabel}
        scheduledIso={m.scheduled_at}
        venue={m.venue}
        status={statusLabel}
        homeScore={m.home_score}
        awayScore={m.away_score}
        matchTime={timeStr}
        rosterSummary={`Sastav ${m.roster_count}/${ROSTER_SIZE}`}
        rosterNeedsAttention={matchNeedsRoster(m)}
      />
    );
  };

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView
          style={[styles.errorCard, { borderColor: colors.borderStrong }]}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && data ? (
        <>
          <ThemedText type="subtitle">Raspored utakmica</ThemedText>
          <ThemedView style={styles.legendBox}>
            <View style={styles.legendLine}>
              <View style={[styles.legendDotSample, { backgroundColor: colors.tint }]} />
              <ThemedText style={styles.legend}>
                — taj dan ima zakazanih utakmica
              </ThemedText>
            </View>
            <View style={styles.legendLine}>
              <MaterialIcons name="star" size={14} color={colors.tint} />
              <ThemedText style={styles.legend}>— sastav još nije kompletan</ThemedText>
            </View>
          </ThemedView>
          {data.all.length === 0 ? (
            <ThemedText style={{ color: colors.textSecondary }}>
              Nema utakmica.
            </ThemedText>
          ) : (
            <MatchTimetableCalendar
              matches={data.all}
              renderMatch={renderMatch}
              onMatchPress={(m) => router.push(`/trener/utakmica/${m.id}` as never)}
              matchesNeedAttention={matchNeedsRoster}
            />
          )}
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  errorCard: { borderWidth: 1, borderRadius: 8, padding: 10 },
  legendBox: { gap: 6 },
  legendLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDotSample: { width: 8, height: 8, borderRadius: 4, marginLeft: 2 },
  legend: { fontSize: 13, opacity: 0.9, flex: 1 },
  errorText: { color: '#c53939' },
});
