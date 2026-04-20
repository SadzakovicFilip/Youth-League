import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Player = {
  player_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  present: boolean;
};

type Payload = {
  training: {
    id: number;
    club_id: number;
    scheduled_at: string;
    topic: string;
    venue: string | null;
    note: string | null;
  } | null;
  can_manage: boolean;
  players: Player[];
};

function playerName(p: Player) {
  return (
    p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || '—'
  );
}

export default function TrenerTreningDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const trainingId = Number(id);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(trainingId)) {
      setErrorMessage('Neispravan ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data: res, error } = await supabase.rpc('get_training_detail', {
      p_training_id: trainingId,
    });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setLoading(false);
      return;
    }
    const payload = (res ?? null) as Payload | null;
    setData(payload);
    setSelected(new Set((payload?.players ?? []).filter((p) => p.present).map((p) => p.player_id)));
    setLoading(false);
  }, [trainingId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = (pid: string) => {
    if (!data?.can_manage) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const onSave = async () => {
    if (!data?.training) return;
    setSaving(true);
    setErrorMessage('');
    const entries = (data.players ?? []).map((p) => ({
      player_id: p.player_id,
      present: selected.has(p.player_id),
    }));
    const { error } = await supabase.rpc('set_training_attendance', {
      p_training_id: trainingId,
      p_entries: entries,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  };

  const presentCount = useMemo(() => selected.size, [selected]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {data?.training ? (
        <ThemedView style={styles.card}>
          <ThemedText type="title">{data.training.topic}</ThemedText>
          <ThemedText>Termin: {fmt(data.training.scheduled_at)}</ThemedText>
          {data.training.venue ? <ThemedText>Mesto: {data.training.venue}</ThemedText> : null}
          {data.training.note ? <ThemedText style={styles.muted}>{data.training.note}</ThemedText> : null}
        </ThemedView>
      ) : null}

      <ThemedText type="subtitle">
        Prisustvo ({presentCount}/{data?.players.length ?? 0})
      </ThemedText>
      {data?.can_manage ? (
        <ThemedText style={styles.muted}>Tap na igraca da oznacis/skines prisustvo, pa pritisni Sacuvaj.</ThemedText>
      ) : (
        <ThemedText style={styles.muted}>Samo trener/klub mogu da beleze prisustvo.</ThemedText>
      )}

      {data?.players.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema igraca u klubu.</ThemedText>
        </ThemedView>
      ) : null}

      {data?.players.map((p) => {
        const isSel = selected.has(p.player_id);
        return (
          <Pressable
            key={p.player_id}
            onPress={() => toggle(p.player_id)}
            disabled={!data?.can_manage}
            style={[styles.playerRow, isSel && styles.playerRowSel]}>
            <ThemedText type="defaultSemiBold">{playerName(p)}</ThemedText>
            <ThemedText style={[styles.badge, isSel ? styles.badgeOn : styles.badgeOff]}>
              {isSel ? 'Prisutan' : 'Nije'}
            </ThemedText>
          </Pressable>
        );
      })}

      {data?.can_manage ? (
        <Pressable
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={onSave}
          disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Sacuvaj prisustvo</ThemedText>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 4 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    padding: 10,
  },
  playerRowSel: { borderColor: '#0a7ea4', backgroundColor: '#eaf4f8' },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    overflow: 'hidden',
    fontWeight: '700',
  },
  badgeOn: { backgroundColor: '#0a7ea4', color: '#fff' },
  badgeOff: { backgroundColor: '#eee', color: '#666' },
  primaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
