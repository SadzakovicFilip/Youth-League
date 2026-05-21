import { useAppTheme } from '@/contexts/app-theme-context';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type MatchRow = {
  id: number;
  league_id: number | null;
  group_id: number | null;
  scheduled_at: string;
  venue: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  home_club_id: number;
  away_club_id: number;
};

function formatDt(iso: string) {
  try {
    return new Date(iso).toLocaleString('sr-Latn');
  } catch {
    return iso;
  }
}

type Props = {
  matchId: number;
};

export type MatchPublicDetailViewHandle = {
  refresh: () => Promise<void>;
};

export const MatchPublicDetailView = forwardRef<MatchPublicDetailViewHandle, Props>(function MatchPublicDetailView(
  { matchId },
  ref,
) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [match, setMatch] = useState<MatchRow | null>(null);
  const [homeName, setHomeName] = useState<string | null>(null);
  const [awayName, setAwayName] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage('Neispravan ID utakmice.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data: row, error } = await supabase
      .from('matches')
      .select(
        'id, league_id, group_id, scheduled_at, venue, status, home_score, away_score, home_club_id, away_club_id',
      )
      .eq('id', matchId)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      setMatch(null);
      setLoading(false);
      return;
    }
    if (!row) {
      setErrorMessage('Utakmica nije pronadjena.');
      setMatch(null);
      setLoading(false);
      return;
    }

    const m = row as MatchRow;
    setMatch(m);

    const { data: clubs } = await supabase
      .from('clubs')
      .select('id, name')
      .in('id', [m.home_club_id, m.away_club_id]);

    const map = new Map((clubs ?? []).map((c: { id: number; name: string | null }) => [c.id, c.name]));
    setHomeName(map.get(m.home_club_id) ?? null);
    setAwayName(map.get(m.away_club_id) ?? null);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: () => load(),
    }),
    [load],
  );

  if (loading) {
    return (
      <ThemedView style={styles.block}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (errorMessage) {
    return (
      <ThemedView style={styles.block}>
        <ThemedText style={styles.err}>{errorMessage}</ThemedText>
      </ThemedView>
    );
  }

  if (!match) return null;

  const hasScore = match.home_score != null && match.away_score != null;

  return (
    <ThemedView style={styles.block}>
      <ThemedText type="subtitle">Pregled utakmice</ThemedText>
      <ThemedText type="defaultSemiBold" style={{ color: colors.text }}>
        {homeName ?? `#${match.home_club_id}`} vs {awayName ?? `#${match.away_club_id}`}
      </ThemedText>
      <ThemedText>Termin: {formatDt(match.scheduled_at)}</ThemedText>
      <ThemedText>Mesto: {match.venue ?? '-'}</ThemedText>
      <ThemedText>Status: {match.status ?? '-'}</ThemedText>
      {hasScore ? (
        <ThemedText>
          Rezultat: {match.home_score} : {match.away_score}
        </ThemedText>
      ) : (
        <ThemedText style={styles.muted}>Rezultat jos nije upisan.</ThemedText>
      )}
    </ThemedView>
  );
});

const styles = StyleSheet.create({
  block: { gap: 8, paddingVertical: 4 },
  err: { color: '#c53939' },
  muted: { opacity: 0.8, fontStyle: 'italic' },
});
