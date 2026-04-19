import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Region = { id: number; name: string };
type League = { id: number; name: string; season: string | null };

export default function RegijaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const regionId = Number(id);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [newName, setNewName] = useState('');
  const [newSeason, setNewSeason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(regionId)) {
      setErrorMessage('Nevazeci region id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_region_detail', { p_region_id: regionId });
    if (error) {
      setErrorMessage(error.message);
      setRegion(null);
      setLeagues([]);
    } else {
      const payload = (data ?? {}) as { region: Region | null; leagues: League[] };
      setRegion(payload.region ?? null);
      setLeagues(payload.leagues ?? []);
    }
    setLoading(false);
  }, [regionId]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const onCreate = async () => {
    if (!newName.trim()) {
      setErrorMessage('Naziv lige je obavezan.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const { error } = await supabase.from('leagues').insert({
      region_id: regionId,
      name: newName.trim(),
      season: newSeason.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNewName('');
    setNewSeason('');
    await loadAll();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">{region?.name ?? 'Regija'}</ThemedText>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Dodaj ligu</ThemedText>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Naziv lige (npr. Prva liga U16)"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <TextInput
          value={newSeason}
          onChangeText={setNewSeason}
          placeholder="Sezona (npr. 2025/26) - opciono"
          placeholderTextColor="#888"
          style={styles.input}
        />
        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={onCreate}
          disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Kreiraj ligu</ThemedText>
          )}
        </Pressable>
      </ThemedView>

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="subtitle">Lige ({leagues.length})</ThemedText>
      {loading ? <ActivityIndicator /> : null}
      {leagues.map((l) => (
        <Pressable
          key={l.id}
          style={styles.sectionCard}
          onPress={() => router.push(`/savez/liga/${l.id}`)}>
          <ThemedView style={styles.rowBetween}>
            <ThemedView>
              <ThemedText type="defaultSemiBold">{l.name}</ThemedText>
              <ThemedText>Sezona: {l.season ?? '-'}</ThemedText>
            </ThemedView>
            <ThemedText style={styles.chevron}>▸</ThemedText>
          </ThemedView>
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionCard: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10 },
  chevron: { fontSize: 16, opacity: 0.8 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#c53939' },
});
