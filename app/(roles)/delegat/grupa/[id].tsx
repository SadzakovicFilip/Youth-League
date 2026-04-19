import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Group = { id: number; league_id: number; name: string };
type Club = { id: number; name: string; league_id: number | null };

export default function DelegatGrupaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = Number(id);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [group, setGroup] = useState<Group | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);

  const load = useCallback(async () => {
    if (!Number.isFinite(groupId)) {
      setErrorMessage('Nevazeca grupa.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const { data: groupRow, error: gErr } = await supabase
      .from('league_groups')
      .select('id, league_id, name')
      .eq('id', groupId)
      .maybeSingle();

    if (gErr) {
      setErrorMessage(gErr.message);
      setLoading(false);
      return;
    }
    setGroup((groupRow ?? null) as Group | null);

    const { data: gcRows, error: gcErr } = await supabase
      .from('group_clubs')
      .select('club_id')
      .eq('group_id', groupId);

    if (gcErr) {
      setErrorMessage(gcErr.message);
      setLoading(false);
      return;
    }

    const clubIds = (gcRows ?? []).map((r: { club_id: number }) => r.club_id);
    if (clubIds.length === 0) {
      setClubs([]);
      setLoading(false);
      return;
    }

    const { data: clubRows, error: cErr } = await supabase
      .from('clubs')
      .select('id, name, league_id')
      .in('id', clubIds)
      .order('name');

    if (cErr) {
      setErrorMessage(cErr.message);
      setLoading(false);
      return;
    }

    setClubs((clubRows ?? []) as Club[]);
    setLoading(false);
  }, [groupId]);

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
      <ThemedText type="title">{group?.name ?? 'Grupa'}</ThemedText>
      <ThemedText>Klubovi u grupi. Tap za tim (igrace i trenere).</ThemedText>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && clubs.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema klubova u grupi.</ThemedText>
        </ThemedView>
      ) : null}

      {clubs.map((c) => (
        <Pressable key={c.id} style={styles.card} onPress={() => router.push(`/delegat/klub/${c.id}`)}>
          <ThemedText type="defaultSemiBold">{c.name}</ThemedText>
          <ThemedText style={styles.hint}>Otvori tim ▸</ThemedText>
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
  card: { borderWidth: 1, borderColor: '#0a7ea4', borderRadius: 8, padding: 10, gap: 4 },
  errorText: { color: '#c53939' },
  hint: { color: '#0a7ea4', fontWeight: '600' },
});
