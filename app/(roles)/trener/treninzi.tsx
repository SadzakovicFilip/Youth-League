import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Training = {
  id: number;
  scheduled_at: string;
  topic: string;
  venue: string | null;
  note: string | null;
  players_total: number;
  players_present: number;
};

type Payload = {
  club: { id: number; name: string } | null;
  can_manage: boolean;
  trainings: Training[];
};

export default function TrenerTreninziScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [clubId, setClubId] = useState<number | null>(null);
  const [data, setData] = useState<Payload | null>(null);

  // form
  const [showForm, setShowForm] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [topic, setTopic] = useState('');
  const [venue, setVenue] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data: cid, error: cErr } = await supabase.rpc('my_trener_or_klub_club_id');
    if (cErr) {
      setErrorMessage(cErr.message);
      setLoading(false);
      return;
    }
    const resolvedClub = typeof cid === 'number' ? cid : cid == null ? null : Number(cid);
    setClubId(resolvedClub);
    if (!resolvedClub) {
      setData(null);
      setLoading(false);
      return;
    }
    const { data: res, error } = await supabase.rpc('get_club_trainings', { p_club_id: resolvedClub });
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

  const onCreate = async () => {
    if (!clubId) return;
    setErrorMessage('');
    if (!dateStr.trim() || !timeStr.trim()) {
      setErrorMessage('Unesi datum i vreme treninga.');
      return;
    }
    if (!topic.trim()) {
      setErrorMessage('Tema treninga je obavezna.');
      return;
    }
    const iso = toIsoFromLocal(dateStr.trim(), timeStr.trim());
    if (!iso) {
      setErrorMessage('Format datuma ili vremena je neispravan. Koristi YYYY-MM-DD i HH:MM.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('create_training', {
      p_club_id: clubId,
      p_scheduled_at: iso,
      p_topic: topic,
      p_venue: venue,
      p_note: note,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setShowForm(false);
    setDateStr('');
    setTimeStr('');
    setTopic('');
    setVenue('');
    setNote('');
    await load();
  };

  const onDelete = (id: number) => {
    Alert.alert('Obrisi trening', 'Da li si siguran?', [
      { text: 'Otkazi', style: 'cancel' },
      {
        text: 'Obrisi',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_training', { p_training_id: id });
          if (error) {
            Alert.alert('Greska', error.message);
            return;
          }
          await load();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>

      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Treninzi</ThemedText>
        {data?.can_manage ? (
          <Pressable style={styles.smallButton} onPress={() => setShowForm((v) => !v)}>
            <ThemedText style={styles.smallButtonText}>
              {showForm ? 'Zatvori' : '+ Dodaj trening'}
            </ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>

      {data?.club?.name ? <ThemedText>{data.club.name}</ThemedText> : null}

      {showForm ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Novi trening</ThemedText>
          <TextInput
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="Datum (YYYY-MM-DD)"
            placeholderTextColor="#888"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={timeStr}
            onChangeText={setTimeStr}
            placeholder="Vreme (HH:MM)"
            placeholderTextColor="#888"
            style={styles.input}
            autoCapitalize="none"
          />
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Tema (npr. suterski, kondicioni, takticki)"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={venue}
            onChangeText={setVenue}
            placeholder="Mesto odrzavanja (opciono)"
            placeholderTextColor="#888"
            style={styles.input}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Napomena (opciono)"
            placeholderTextColor="#888"
            style={[styles.input, styles.inputMulti]}
            multiline
          />
          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={onCreate}
            disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Sacuvaj trening</ThemedText>
            )}
          </Pressable>
        </ThemedView>
      ) : null}

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && !clubId ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nisi dodeljen nijednom klubu.</ThemedText>
        </ThemedView>
      ) : null}

      {data && data.trainings.length === 0 && !loading ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema zakazanih treninga.</ThemedText>
        </ThemedView>
      ) : null}

      {data?.trainings.map((t) => (
        <ThemedView key={t.id} style={styles.trainCard}>
          <Pressable style={styles.trainOpen} onPress={() => router.push(`/trener/trening/${t.id}`)}>
            <ThemedText type="defaultSemiBold">{t.topic}</ThemedText>
            <ThemedText>Termin: {fmt(t.scheduled_at)}</ThemedText>
            {t.venue ? <ThemedText>Mesto: {t.venue}</ThemedText> : null}
            {t.note ? <ThemedText style={styles.muted}>{t.note}</ThemedText> : null}
            <ThemedText style={styles.hint}>
              Prisustvo: {t.players_present}/{t.players_total} ▸
            </ThemedText>
          </Pressable>
          {data?.can_manage ? (
            <Pressable style={styles.removeMini} onPress={() => onDelete(t.id)}>
              <ThemedText style={styles.removeText}>Obrisi ✕</ThemedText>
            </Pressable>
          ) : null}
        </ThemedView>
      ))}
    </ScrollView>
  );
}

function toIsoFromLocal(dateStr: string, timeStr: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  if (!dateMatch || !timeMatch) return null;
  const [, y, m, d] = dateMatch;
  const [, hh, mm] = timeMatch;
  const h = Number(hh);
  const min = Number(mm);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d), h, min, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
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
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  input: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111',
    backgroundColor: '#fff',
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  button: {
    marginTop: 6,
    minHeight: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  buttonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  trainCard: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
  },
  trainOpen: { flex: 1, padding: 10, gap: 2 },
  hint: { color: '#0a7ea4', fontWeight: '600', marginTop: 2 },
  muted: { color: '#888', fontStyle: 'italic' },
  removeMini: {
    borderLeftWidth: 1,
    borderLeftColor: '#c53939',
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  removeText: { color: '#c53939', fontWeight: '600' },
});
