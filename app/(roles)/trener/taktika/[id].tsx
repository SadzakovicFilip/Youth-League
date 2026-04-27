import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Kind = 'attack' | 'defense';

type ActionRow = {
  id?: number;
  name: string;
  description: string;
  position: number;
};

type Detail = {
  tactic: {
    id: number;
    club_id: number;
    name: string;
    kind: Kind;
    description: string | null;
    is_active: boolean;
    updated_at: string;
  };
  can_manage: boolean;
  actions: { id: number; name: string; description: string | null; position: number }[];
};

export default function TrenerTaktikaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const tacticId = isNew ? null : Number(id);

  const [loading, setLoading] = useState(!isNew);
  const [errorMessage, setErrorMessage] = useState('');
  const [clubId, setClubId] = useState<number | null>(null);
  const [canManage, setCanManage] = useState(true);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('attack');
  const [description, setDescription] = useState('');
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErrorMessage('');
    if (isNew) {
      const { data: cid, error: cErr } = await supabase.rpc('my_trener_or_klub_club_id');
      if (cErr) {
        setErrorMessage(cErr.message);
        return;
      }
      setClubId(typeof cid === 'number' ? cid : cid == null ? null : Number(cid));
      return;
    }
    if (!Number.isFinite(tacticId)) {
      setErrorMessage('Neispravan ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: res, error } = await supabase.rpc('get_tactic_detail', {
      p_tactic_id: tacticId,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const payload = res as Detail;
    setClubId(payload?.tactic?.club_id ?? null);
    setCanManage(!!payload?.can_manage);
    setName(payload?.tactic?.name ?? '');
    setKind((payload?.tactic?.kind ?? 'attack') as Kind);
    setDescription(payload?.tactic?.description ?? '');
    setActions(
      (payload?.actions ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description ?? '',
        position: a.position,
      }))
    );
    setLoading(false);
  }, [isNew, tacticId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const addAction = () => {
    setActions((prev) => [...prev, { name: '', description: '', position: prev.length + 1 }]);
  };

  const removeAction = (idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx).map((a, i) => ({ ...a, position: i + 1 })));
  };

  const updateAction = (idx: number, patch: Partial<ActionRow>) => {
    setActions((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const onSave = async () => {
    setErrorMessage('');
    if (!name.trim()) {
      setErrorMessage('Ime taktike je obavezno.');
      return;
    }
    if (!clubId) {
      setErrorMessage('Klub nije pronadjen.');
      return;
    }
    const filtered = actions
      .filter((a) => a.name.trim())
      .map((a, i) => ({
        name: a.name.trim(),
        description: a.description.trim(),
        position: i + 1,
      }));
    setSaving(true);
    const { error } = await supabase.rpc('upsert_tactic', {
      p_tactic_id: tacticId,
      p_club_id: clubId,
      p_name: name,
      p_kind: kind,
      p_description: description,
      p_actions: filtered,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.back();
  };

  const onDelete = () => {
    if (!tacticId) return;
    Alert.alert('Obrisi taktiku', 'Sve akcije ce takodje biti obrisane.', [
      { text: 'Otkazi', style: 'cancel' },
      {
        text: 'Obrisi',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_tactic', { p_tactic_id: tacticId });
          if (error) {
            Alert.alert('Greska', error.message);
            return;
          }
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>

      <ThemedText type="title">{isNew ? 'Nova taktika' : 'Izmena taktike'}</ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="defaultSemiBold">Tip taktike</ThemedText>
      <ThemedView style={styles.kindRow}>
        <Pressable
          style={[styles.kindButton, kind === 'attack' && styles.kindButtonActive]}
          onPress={() => canManage && setKind('attack')}>
          <ThemedText style={kind === 'attack' ? styles.kindTextActive : styles.kindText}>Napad</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.kindButton, kind === 'defense' && styles.kindButtonActive]}
          onPress={() => canManage && setKind('defense')}>
          <ThemedText style={kind === 'defense' ? styles.kindTextActive : styles.kindText}>Odbrana</ThemedText>
        </Pressable>
      </ThemedView>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={kind === 'attack' ? 'Ime napada' : 'Ime odbrane'}
        placeholderTextColor="#888"
        style={styles.input}
        editable={canManage}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Opis (opciono)"
        placeholderTextColor="#888"
        style={[styles.input, styles.inputMulti]}
        multiline
        editable={canManage}
      />

      <ThemedView style={styles.sectionRow}>
        <ThemedText type="subtitle">Akcije</ThemedText>
        {canManage ? (
          <Pressable style={styles.smallButton} onPress={addAction}>
            <ThemedText style={styles.smallButtonText}>+ Dodaj akciju</ThemedText>
          </Pressable>
        ) : null}
      </ThemedView>

      {actions.length === 0 ? (
        <ThemedText style={styles.muted}>Jos nema akcija. Dodaj bar jednu.</ThemedText>
      ) : null}

      {actions.map((a, idx) => (
        <ThemedView key={idx} style={styles.actionCard}>
          <ThemedView style={styles.actionHeader}>
            <ThemedText type="defaultSemiBold">#{idx + 1}</ThemedText>
            {canManage ? (
              <Pressable onPress={() => removeAction(idx)}>
                <ThemedText style={styles.removeText}>Ukloni ✕</ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
          <TextInput
            value={a.name}
            onChangeText={(v) => updateAction(idx, { name: v })}
            placeholder="Ime akcije"
            placeholderTextColor="#888"
            style={styles.input}
            editable={canManage}
          />
          <TextInput
            value={a.description}
            onChangeText={(v) => updateAction(idx, { description: v })}
            placeholder="Opis akcije"
            placeholderTextColor="#888"
            style={[styles.input, styles.inputMulti]}
            multiline
            editable={canManage}
          />
        </ThemedView>
      ))}

      {canManage ? (
        <>
          <Pressable
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={onSave}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>
                {isNew ? 'Sacuvaj taktiku' : 'Sacuvaj izmene'}
              </ThemedText>
            )}
          </Pressable>
          {!isNew ? (
            <Pressable style={styles.dangerButton} onPress={onDelete}>
              <ThemedText style={styles.dangerButtonText}>Obrisi taktiku</ThemedText>
            </Pressable>
          ) : null}
        </>
      ) : null}
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
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
  kindRow: { flexDirection: 'row', gap: 8 },
  kindButton: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  kindButtonActive: { borderColor: '#0a7ea4', backgroundColor: '#0a7ea4' },
  kindText: { color: '#333', fontWeight: '600' },
  kindTextActive: { color: '#fff', fontWeight: '700' },
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
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: { color: '#0a7ea4', fontWeight: '600' },
  actionCard: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  removeText: { color: '#c53939', fontWeight: '600' },
  primaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  dangerButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c53939',
  },
  dangerButtonText: { color: '#c53939', fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
});
