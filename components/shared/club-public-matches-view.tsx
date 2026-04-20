import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  side: 'home' | 'away';
  result?: string;
};

type Payload = {
  club_id: number;
  played: MatchRow[];
  upcoming: MatchRow[];
};

export type ClubPublicMatchesViewProps = {
  clubId: number;
};

function fmt(iso: string | null | undefined) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function resultLabel(r?: string) {
  if (r === 'W') return 'Pobeda';
  if (r === 'L') return 'Poraz';
  if (r === 'N') return 'Nereseno';
  return r ?? '-';
}

export function ClubPublicMatchesView({ clubId }: ClubPublicMatchesViewProps) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
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
    load();
  }, [load]);

  const played = data?.played ?? [];
  const upcoming = data?.upcoming ?? [];

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
          <ThemedText type="subtitle">Predstojece utakmice ({upcoming.length})</ThemedText>
          {upcoming.length === 0 ? (
            <ThemedText style={styles.muted}>Nema zakazanih utakmica.</ThemedText>
          ) : (
            upcoming.map((m) => {
              const opp =
                m.side === 'home'
                  ? (m.away_club_name ?? `#${m.away_club_id}`)
                  : (m.home_club_name ?? `#${m.home_club_id}`);
              const prefix = m.side === 'home' ? 'vs' : '@';
              return (
                <ThemedView key={m.id} style={styles.card}>
                  <ThemedText type="defaultSemiBold">
                    {prefix} {opp}
                  </ThemedText>
                  <ThemedText>Termin: {fmt(m.scheduled_at)}</ThemedText>
                  {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                  <ThemedText>Status: {m.status}</ThemedText>
                  {m.home_score != null && m.away_score != null ? (
                    <ThemedText>
                      {m.status === 'live' ? 'Uzivo: ' : 'Rezultat: '}
                      {m.home_score} : {m.away_score}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              );
            })
          )}

          <ThemedText type="subtitle">Odigrane utakmice ({played.length})</ThemedText>
          {played.length === 0 ? (
            <ThemedText style={styles.muted}>Nema odigranih utakmica.</ThemedText>
          ) : (
            played.map((m) => {
              const opp =
                m.side === 'home'
                  ? (m.away_club_name ?? `#${m.away_club_id}`)
                  : (m.home_club_name ?? `#${m.home_club_id}`);
              const prefix = m.side === 'home' ? 'vs' : '@';
              return (
                <ThemedView key={m.id} style={styles.card}>
                  <ThemedText type="defaultSemiBold">
                    {fmt(m.scheduled_at)} — {prefix} {opp} ({resultLabel(m.result)})
                  </ThemedText>
                  <ThemedText>
                    Rezultat: {m.home_score ?? '-'} : {m.away_score ?? '-'}
                  </ThemedText>
                </ThemedView>
              );
            })
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  card: { borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 8, gap: 2 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 6, padding: 8 },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
});
