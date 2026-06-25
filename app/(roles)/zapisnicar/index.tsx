import { router, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import {
  MatchRichCard,
  formatScore,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  formatMatchDisplayStatus,
  isMatchDisplayFinished,
} from '@/lib/match-display-status';
import { supabase } from '@/lib/supabase';

type MatchRow = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  display_status?: string | null;
};

function clubLabel(name: string | null, id: number): string {
  return name?.trim() ? name.trim() : `#${id}`;
}

function matchHeadline(m: MatchRow): string {
  return `${clubLabel(m.home_club_name, m.home_club_id)} — ${clubLabel(m.away_club_name, m.away_club_id)}`;
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

export default function ZapisnicarHomeScreen() {
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

  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage('Nema aktivne sesije.');
      setLoading(false);
      return;
    }

    const matchesRes = await supabase.rpc('get_my_zapisnicar_matches');

    if (matchesRes.error) setErrorMessage(matchesRes.error.message);
    else setMatches((matchesRes.data as MatchRow[]) ?? []);

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
    const statusLabel = formatMatchDisplayStatus(m);
    const finishedLike = isMatchDisplayFinished(m);

    if (finishedLike) {
      return (
        <MatchRichCard
          variant="club_played"
          theme={matchRichTheme}
          oppName={headline}
          headline={headline}
          scheduledIso={m.scheduled_at}
          scoreLine={formatScore(m.home_score, m.away_score)}
          outcome={null}
        />
      );
    }

    return (
      <MatchRichCard
        variant="club_upcoming"
        theme={matchRichTheme}
        oppName={headline}
        headline={headline}
        scheduledIso={m.scheduled_at}
        venue={m.venue}
        status={statusLabel}
        homeScore={m.home_score}
        awayScore={m.away_score}
        matchTime={formatMatchTimeSr(m.scheduled_at)}
      />
    );
  };

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {errorMessage ? (
          <ThemedView style={[styles.errorCard, { borderColor: colors.borderStrong }]}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : null}

        {loading ? <ActivityIndicator color={colors.tint} /> : null}

        {!loading && matches.length === 0 ? (
          <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>Nema dodeljenih utakmica.</ThemedText>
          </ThemedView>
        ) : null}

        {!loading && matches.length > 0 ? (
          <MatchTimetableCalendar
            matches={matches}
            onMatchPress={(m) => router.push(`/zapisnicar/utakmica/${m.id}` as never)}
            renderMatch={renderMatch}
            daySelectSoundId="ballBounce2"
          />
        ) : null}
      </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderRadius: 10, padding: 12 },
  errorCard: { borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
});
