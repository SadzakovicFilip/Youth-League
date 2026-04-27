import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Row = {
  league_id: number;
  league_name: string;
  region_id: number | null;
  region_name: string | null;
  club_id: number;
  club_name: string;
  is_my_club: boolean;
};

type LeagueGroup = {
  league_id: number;
  league_name: string;
  region_name: string | null;
  clubs: Row[];
};

export default function TrenerMojaLigaScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_trener_league_clubs');
    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grouped = useMemo<LeagueGroup[]>(() => {
    const byLeague = new Map<number, LeagueGroup>();
    for (const r of rows) {
      let g = byLeague.get(r.league_id);
      if (!g) {
        g = {
          league_id: r.league_id,
          league_name: r.league_name,
          region_name: r.region_name,
          clubs: [],
        };
        byLeague.set(r.league_id, g);
      }
      g.clubs.push(r);
    }
    return Array.from(byLeague.values());
  }, [rows]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">Moja liga</ThemedText>
      <ThemedText>Svi klubovi u ligi (ili ligama) u kojima si trener. Tap za tim.</ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && grouped.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nisi trener ni u jednom klubu ili liga nije dodeljena.</ThemedText>
        </ThemedView>
      ) : null}

      {grouped.map((g) => (
        <ThemedView key={g.league_id} style={{ gap: 6 }}>
          <ThemedText type="subtitle">{g.league_name}</ThemedText>
          {g.region_name ? <ThemedText style={styles.muted}>Regija: {g.region_name}</ThemedText> : null}
          {g.clubs.map((c) => (
            <Pressable
              key={c.club_id}
              style={[styles.card, c.is_my_club && styles.cardMine]}
              onPress={() => router.push(`/trener/klub/${c.club_id}`)}>
              <ThemedText type="defaultSemiBold">
                {c.club_name}{c.is_my_club ? '  (moj klub)' : ''}
              </ThemedText>
              <ThemedText style={styles.hint}>Otvori tim ▸</ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: '600' },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: { color: '#0a7ea4', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 4 },
  cardMine: { borderColor: '#0a7ea4', backgroundColor: '#eaf4f8' },
  errorText: { color: '#c53939' },
  hint: { color: '#0a7ea4', fontWeight: '600' },
  muted: { color: '#888', fontStyle: 'italic' },
});
