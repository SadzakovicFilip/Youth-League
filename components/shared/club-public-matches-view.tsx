import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { MatchRichCard, formatScore, playedOutcomeLetter, type MatchRichTheme } from '@/components/shared/match-rich-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAppTheme } from '@/contexts/app-theme-context';
import { supabase } from '@/lib/supabase';

export type ClubPublicMatchRow = {
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
  side: 'home' | 'away';
  result?: string;
};

type Payload = {
  club_id: number;
  played: ClubPublicMatchRow[];
  upcoming: ClubPublicMatchRow[];
};

export function useClubPublicMatches(clubId: number) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const reload = useCallback(async () => {
    if (!Number.isFinite(clubId)) return;
    setLoading(true);
    setErrorMessage('');
    const { data: rpcData, error } = await supabase.rpc('get_club_public_matches', { p_club_id: clubId });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setLoading(false);
      return;
    }
    setData((rpcData ?? null) as Payload | null);
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, errorMessage, reload };
}

export type ClubPublicMatchesViewProps = {
  clubId: number;
};

export function ClubPublicMatchesView({ clubId }: ClubPublicMatchesViewProps) {
  const { data, loading, errorMessage } = useClubPublicMatches(clubId);
  const { colors } = useAppTheme();
  const played = data?.played ?? [];
  const upcoming = data?.upcoming ?? [];

  const theme: MatchRichTheme = {
    surfaceMuted: colors.surfaceMuted,
    borderStrong: colors.borderStrong,
    tint: colors.tint,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    danger: colors.danger,
  };

  return (
    <View style={styles.container}>
      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage ? (
        <>
          <ThemedText type="subtitle">Predstojeće ({upcoming.length})</ThemedText>
          {upcoming.length === 0 ? (
            <ThemedText style={styles.muted}>Nema zakazanih utakmica.</ThemedText>
          ) : (
            upcoming.map((m) => {
              const opp =
                m.side === 'home'
                  ? (m.away_club_name ?? `#${m.away_club_id}`)
                  : (m.home_club_name ?? `#${m.home_club_id}`);
              return (
                <MatchRichCard
                  key={m.id}
                  variant="club_upcoming"
                  theme={theme}
                  oppName={opp}
                  scheduledIso={m.scheduled_at}
                  venue={m.venue}
                  status={m.status}
                  homeScore={m.home_score}
                  awayScore={m.away_score}
                />
              );
            })
          )}

          <ThemedText type="subtitle" style={styles.gapTop}>
            Odigrane ({played.length})
          </ThemedText>
          {played.length === 0 ? (
            <ThemedText style={styles.muted}>Nema odigranih utakmica.</ThemedText>
          ) : (
            played.map((m) => {
              const opp =
                m.side === 'home'
                  ? (m.away_club_name ?? `#${m.away_club_id}`)
                  : (m.home_club_name ?? `#${m.home_club_id}`);
              const scoreLine = formatScore(m.home_score, m.away_score);
              const outcome = playedOutcomeLetter(m.side, m.home_score, m.away_score, m.result);
              return (
                <MatchRichCard
                  key={m.id}
                  variant="club_played"
                  theme={theme}
                  oppName={opp}
                  scheduledIso={m.scheduled_at}
                  scoreLine={scoreLine}
                  outcome={outcome}
                />
              );
            })
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  gapTop: { marginTop: 8 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 6, padding: 8 },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
});
