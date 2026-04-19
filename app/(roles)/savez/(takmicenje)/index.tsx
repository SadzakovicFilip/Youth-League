import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Region = { id: number; name: string };

export default function SavezHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRegions = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase
      .from('regions')
      .select('id, name')
      .order('name', { ascending: true });
    if (error) {
      setErrorMessage(error.message);
      setRegions([]);
    } else {
      setRegions((data ?? []) as Region[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRegions();
    }, [loadRegions])
  );

  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout greska', error.message);
      return;
    }
    router.replace('/login');
  };

  const onCreate = async () => {
    if (!newName.trim()) {
      setErrorMessage('Naziv regije je obavezan.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    const { error } = await supabase.from('regions').insert({ name: newName.trim() });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNewName('');
    await loadRegions();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Takmicenje</ThemedText>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedText>Lista regija. Klikni na regiju za dalje upravljanje ligama.</ThemedText>

      <ThemedView style={styles.card}>
        <ThemedText type="subtitle">Dodaj regiju</ThemedText>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="npr. Beograd"
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
            <ThemedText style={styles.buttonText}>Kreiraj regiju</ThemedText>
          )}
        </Pressable>
      </ThemedView>

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="subtitle">Regije ({regions.length})</ThemedText>
      {loading ? <ActivityIndicator /> : null}
      {regions.map((r) => (
        <Pressable
          key={r.id}
          style={styles.sectionCard}
          onPress={() => router.push(`/savez/regija/${r.id}`)}>
          <ThemedView style={styles.rowBetween}>
            <ThemedText type="defaultSemiBold">{r.name}</ThemedText>
            <ThemedText style={styles.chevron}>▸</ThemedText>
          </ThemedView>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { color: '#c53939', fontWeight: '600' },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
  },
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
