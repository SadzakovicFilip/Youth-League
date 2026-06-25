import { ActionAccentHex } from '@/constants/theme';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import type { BreadcrumbItem } from '@/components/savez/savez-breadcrumbs';
import { ThemedTextInput } from '@/components/themed-text-input';
import { SavezNumberedListBlock, SavezNumberedListRow } from '@/components/savez/savez-numbered-list';
import { useSyncTakmicenjeDrillChrome } from '@/contexts/takmicenje-drill-chrome-context';
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
  const [showAddLeagueForm, setShowAddLeagueForm] = useState(false);

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

  const chromeTitle = region?.name ?? `Regija #${regionId}`;
  const chromeItems = useMemo<BreadcrumbItem[]>(
    () => [{ label: 'Regije', path: '/savez' }, { label: chromeTitle }],
    [chromeTitle],
  );
  useSyncTakmicenjeDrillChrome(true, chromeTitle, chromeItems);

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
    setShowAddLeagueForm(false);
    await loadAll();
  };

  useScreenPullRefresh(loadAll);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">Lige ({leagues.length})</ThemedText>
        <Pressable
          style={styles.headerFilledButton}
          onPress={() => {
            if (showAddLeagueForm) {
              setShowAddLeagueForm(false);
              setNewName('');
              setNewSeason('');
              setErrorMessage('');
            } else {
              setErrorMessage('');
              setShowAddLeagueForm(true);
            }
          }}>
          <ThemedText style={styles.headerFilledButtonText}>
            {showAddLeagueForm ? 'Zatvori' : '+ Dodaj ligu'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      {showAddLeagueForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Nova liga</ThemedText>
          <ThemedTextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Naziv lige (npr. Prva liga U16)"
            style={styles.inputSpacing}
          />
          <ThemedTextInput
            value={newSeason}
            onChangeText={setNewSeason}
            placeholder="Sezona (npr. 2025/26) - opciono"
            style={styles.inputSpacing}
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
      ) : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <SavezNumberedListBlock
        hint="Klik na red otvara ligu."
        emptyLabel="Nema liga u ovoj regiji."
        loading={loading}
        isEmpty={leagues.length === 0}>
        {leagues.map((l, idx) => (
          <SavezNumberedListRow key={l.id} index={idx} onPress={() => router.push(`/savez/liga/${l.id}`)}>
            <ThemedText type="defaultSemiBold">{l.name}</ThemedText>
            <ThemedText>Sezona: {l.season ?? '-'}</ThemedText>
          </SavezNumberedListRow>
        ))}
      </SavezNumberedListBlock>
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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
  inputSpacing: { marginTop: 4 },
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
