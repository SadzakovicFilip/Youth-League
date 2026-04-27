import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

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

export default function TrenerMatchesScreen() {
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
      load();
    }, [load])
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const renderMatch = (m: MatchRow) => {
    const opponent = m.side === 'home' ? m.away_club_name : m.home_club_name;
    const prefix = m.side === 'home' ? 'vs' : '@';
    const hasResult = m.home_score != null && m.away_score != null;
    return (
      <Pressable
        key={m.id}
        style={styles.card}
        onPress={() => router.push(`/trener/utakmica/${m.id}` as never)}>
        <ThemedText type="defaultSemiBold">
          {prefix} {opponent ?? '-'}
        </ThemedText>
        <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
        {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
        <ThemedText>
          Rezultat: {hasResult ? `${m.home_score}:${m.away_score}` : 'nije upisano'}
        </ThemedText>
        <ThemedText style={styles.muted}>
          Sastav: {m.roster_count}/12 {m.phase === 'upcoming' ? '• tap za dodelu' : ''}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Utakmice</ThemedText>
      {data?.context ? (
        <ThemedView style={styles.ctxCard}>
          <ThemedText type="defaultSemiBold">{data.context.club_name}</ThemedText>
          <ThemedText>Liga: {data.context.league_name ?? '-'}</ThemedText>
          <ThemedText>Grupa: {data.context.group_name ?? '-'}</ThemedText>
        </ThemedView>
      ) : null}

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && data ? (
        <>
          <ThemedText type="subtitle">Sledece utakmice</ThemedText>
          {data.upcoming.length === 0 ? (
            <ThemedText style={styles.muted}>Nema sledecih utakmica.</ThemedText>
          ) : (
            data.upcoming.map(renderMatch)
          )}

          <ThemedText type="subtitle" style={{ marginTop: 10 }}>
            Sve utakmice
          </ThemedText>
          {data.all.length === 0 ? (
            <ThemedText style={styles.muted}>Nema utakmica.</ThemedText>
          ) : (
            data.all.map(renderMatch)
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 4 },
  ctxCard: { borderWidth: 1, borderColor: '#0a7ea4', borderRadius: 8, padding: 10, gap: 4 },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: { color: '#0a7ea4', fontWeight: '600' },
  errorText: { color: '#c53939' },
  muted: { color: '#888' },
});
