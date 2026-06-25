import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import {
  MatchRichCard,
  formatScore,
  playedOutcomeLetter,
  type MatchRichTheme,
} from '@/components/shared/match-rich-card';
import { MatchCalendarLegend } from '@/components/shared/match-calendar-legend';
import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { useIgracDashboard } from '@/contexts/igrac-dashboard-context';
import type { IgracHubPlayed, IgracHubUpcoming } from '@/lib/igrac-dashboard-types';
import { formatMatchDisplayStatus, isMatchDisplayFinished } from '@/lib/match-display-status';

import { IgracScreenState } from './igrac-screen-state';

type TimetableMatch =
  | (IgracHubUpcoming & { phase: 'upcoming' })
  | (IgracHubPlayed & { id: number; phase: 'played' });

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

export function IgracUtakmiceContent() {
  const { colors } = useAppTheme();
  const { loading, errorMessage, data } = useIgracDashboard();
  const matchHub = data?.match_hub ?? null;

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

  const timetableMatches = useMemo((): TimetableMatch[] => {
    if (!matchHub) return [];
    const upcoming = matchHub.upcoming.map((u) => ({ ...u, phase: 'upcoming' as const }));
    const played = matchHub.played.map((p) => ({
      ...p,
      id: p.match_id,
      phase: 'played' as const,
    }));
    return [...upcoming, ...played];
  }, [matchHub]);

  const renderMatch = (m: TimetableMatch) => {
    const opponent =
      m.side === 'home'
        ? (m.away_club_name ?? null)
        : (m.home_club_name ?? null);
    const oppLabel = opponent?.trim() ? opponent.trim() : '—';

    if (m.phase === 'played') {
      const scoreLine = formatScore(m.home_score, m.away_score);
      const outcome = playedOutcomeLetter(m.side, m.home_score, m.away_score, m.result);
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

    if (isMatchDisplayFinished(m)) {
      const scoreLine = formatScore(m.home_score, m.away_score);
      const outcome = playedOutcomeLetter(m.side, m.home_score, m.away_score, null);
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

    const statusLabel = formatMatchDisplayStatus(m);
    const timeStr = formatMatchTimeSr(m.scheduled_at);

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
      />
    );
  };

  return (
    <>
      <IgracScreenState loading={loading} errorMessage={errorMessage} />

      {!loading && !errorMessage ? (
        !matchHub?.club_id ? (
          <ThemedView style={[styles.card, { borderColor: colors.borderStrong }]}>
            <ThemedText style={{ color: colors.textSecondary }}>
              Nisi u klubu kao igrač ili nema podataka.
            </ThemedText>
          </ThemedView>
        ) : (
          <>
            <ThemedText type="subtitle" style={{ color: colors.text }}>
              Raspored utakmica
            </ThemedText>

            <MatchCalendarLegend />

            {timetableMatches.length === 0 ? (
              <ThemedText style={{ color: colors.textSecondary }}>Nema utakmica u rasporedu.</ThemedText>
            ) : (
              <MatchTimetableCalendar
                matches={timetableMatches}
                onMatchPress={(m) => router.push(`/igrac/utakmica/${m.id}` as never)}
                renderMatch={renderMatch}
                daySelectSoundId="ballBounce2"
              />
            )}
          </>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
});
