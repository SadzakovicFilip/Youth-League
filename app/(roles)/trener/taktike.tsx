import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Tactic = {
  id: number;
  name: string;
  kind: 'attack' | 'defense';
  description: string | null;
  is_active: boolean;
  actions_count: number;
  updated_at: string;
};

type Payload = {
  club_id: number;
  can_manage: boolean;
  tactics: Tactic[];
};

export default function TrenerTaktikeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [clubId, setClubId] = useState<number | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data: cid, error: cErr } = await supabase.rpc('my_trener_or_klub_club_id');
    if (cErr) {
      setErrorMessage(cErr.message);
      setLoading(false);
      return;
    }
    const resolved = typeof cid === 'number' ? cid : cid == null ? null : Number(cid);
    setClubId(resolved);
    if (!resolved) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: res, error } = await supabase.rpc('get_club_tactics', {
      p_club_id: resolved,
      p_kind: null,
    });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
    } else {
      setData((res ?? null) as Payload | null);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const attack = useMemo(() => (data?.tactics ?? []).filter((t) => t.kind === 'attack'), [data]);
  const defense = useMemo(() => (data?.tactics ?? []).filter((t) => t.kind === 'defense'), [data]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>

      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Taktike</ThemedText>
        {data?.can_manage ? (
          <Pressable
            style={styles.smallButton}
            onPress={() => router.push('/trener/taktika/new')}>
            <ThemedText style={styles.smallButtonText}>+ Dodaj taktiku</ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !clubId ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nisi dodeljen klubu.</ThemedText>
        </ThemedView>
      ) : null}

      {data ? (
        <>
          <ThemedText type="subtitle">Napad ({attack.length})</ThemedText>
          {attack.length === 0 ? <ThemedText style={styles.muted}>Nema taktika.</ThemedText> : null}
          {attack.map((t) => (
            <TacticRow key={t.id} tactic={t} />
          ))}

          <ThemedText type="subtitle">Odbrana ({defense.length})</ThemedText>
          {defense.length === 0 ? <ThemedText style={styles.muted}>Nema taktika.</ThemedText> : null}
          {defense.map((t) => (
            <TacticRow key={t.id} tactic={t} />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function TacticRow({ tactic }: { tactic: Tactic }) {
  return (
    <Pressable
      style={styles.tacticCard}
      onPress={() => router.push(`/trener/taktika/${tactic.id}`)}>
      <ThemedText type="defaultSemiBold">{tactic.name}</ThemedText>
      {tactic.description ? <ThemedText style={styles.muted}>{tactic.description}</ThemedText> : null}
      <ThemedText style={styles.hint}>Akcija: {tactic.actions_count} ▸</ThemedText>
    </Pressable>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { color: '#0a7ea4', fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 4 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  tacticCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 2,
  },
  hint: { color: '#0a7ea4', fontWeight: '600', marginTop: 2 },
  muted: { color: '#888', fontStyle: 'italic' },
});
