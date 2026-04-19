import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type LeagueRow = {
  league_id: number;
  league_name: string;
  region_id: number | null;
  region_name: string | null;
  group_count: number;
  club_count: number;
};

export default function DelegatLigeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<LeagueRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_delegate_leagues');
    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as LeagueRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">Moje lige</ThemedText>
      <ThemedText>Lige za koje si delegat. Tap za grupe i klubove.</ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && rows.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nisi delegat ni u jednoj ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {rows.map((r) => (
        <Pressable key={r.league_id} style={styles.card} onPress={() => router.push(`/delegat/liga/${r.league_id}`)}>
          <ThemedText type="defaultSemiBold">{r.league_name}</ThemedText>
          <ThemedText>Regija: {r.region_name ?? '-'}</ThemedText>
          <ThemedText>Grupa: {r.group_count}  |  Klubova: {r.club_count}</ThemedText>
          <ThemedText style={styles.hint}>Otvori ▸</ThemedText>
        </Pressable>
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
  card: { borderWidth: 1, borderColor: '#0a7ea4', borderRadius: 8, padding: 10, gap: 4 },
  errorText: { color: '#c53939' },
  hint: { color: '#0a7ea4', fontWeight: '600' },
});
