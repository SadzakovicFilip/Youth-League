import { ActionAccentHex } from '@/constants/theme';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { ThemedTextInput } from '@/components/themed-text-input';

import { SavezNumberedListBlock, SavezNumberedListRow } from '@/components/savez/savez-numbered-list';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { supabase } from '@/lib/supabase';

type Region = { id: number; name: string };

export default function SavezHomeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAddRegionForm, setShowAddRegionForm] = useState(false);

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

  useScreenPullRefresh(loadRegions);

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
    setShowAddRegionForm(false);
    await loadRegions();
  };

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Regije ({regions.length})</ThemedText>
        <Pressable
          style={styles.headerFilledButton}
          onPress={() => {
            if (showAddRegionForm) {
              setShowAddRegionForm(false);
              setNewName('');
              setErrorMessage('');
            } else {
              setErrorMessage('');
              setShowAddRegionForm(true);
            }
          }}>
          <ThemedText style={styles.headerFilledButtonText}>
            {showAddRegionForm ? 'Zatvori' : '+ Dodaj regiju'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {showAddRegionForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nova regija</ThemedText>
          <ThemedTextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="npr. Beograd"
            style={styles.inputSpacing}
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
      ) : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <SavezNumberedListBlock
        hint="Klik na red otvara regiju."
        emptyLabel="Nema unetih regija."
        loading={loading}
        isEmpty={regions.length === 0}>
        {regions.map((r, idx) => (
          <SavezNumberedListRow key={r.id} index={idx} onPress={() => router.push(`/savez/regija/${r.id}`)}>
            <ThemedText type="defaultSemiBold">{r.name}</ThemedText>
          </SavezNumberedListRow>
        ))}
      </SavezNumberedListBlock>
    </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  inputSpacing: { marginTop: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  headerFilledButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: ActionAccentHex,
  },
  headerFilledButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  button: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ActionAccentHex,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  errorText: { color: '#c53939' },
});
