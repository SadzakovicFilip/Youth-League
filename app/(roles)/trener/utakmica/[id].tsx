import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type MatchInfo = {
  id: number;
  home_club_id: number;
  away_club_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string | null;
  home_score: number | null;
  away_score: number | null;
  home_club_name: string | null;
  away_club_name: string | null;
  side: 'home' | 'away';
};

type RosterItem = {
  user_id: string;
  jersey_number: number;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type PlayerRow = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  license_valid_until: string | null;
  license_number: string | null;
  is_eligible: boolean;
};

type Payload = {
  match: MatchInfo;
  club_id: number;
  can_edit: boolean;
  roster: RosterItem[];
  players: PlayerRow[];
};

const JERSEYS = Array.from({ length: 12 }, (_, i) => i + 4); // 4..15
const MAX_ROSTER = 12;

function playerName(p: Pick<PlayerRow, 'display_name' | 'first_name' | 'last_name' | 'username'>) {
  return (
    p.display_name ||
    [p.first_name, p.last_name].filter(Boolean).join(' ') ||
    p.username ||
    'Bez imena'
  );
}

export default function TrenerMatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [info, setInfo] = useState<Payload | null>(null);

  // jersey -> user_id
  const [assigned, setAssigned] = useState<Record<number, string | null>>({});

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage('Neispravan ID utakmice');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_trener_match_detail', {
      p_match_id: matchId,
      p_club_id: null,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const payload = data as Payload;
    setInfo(payload);

    const initial: Record<number, string | null> = {};
    for (const j of JERSEYS) initial[j] = null;
    for (const r of payload.roster ?? []) initial[r.jersey_number] = r.user_id;
    setAssigned(initial);
    setLoading(false);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  const matchDate = info?.match.scheduled_at ? new Date(info.match.scheduled_at) : null;

  const assignedUserIds = useMemo(
    () => new Set(Object.values(assigned).filter((v): v is string => !!v)),
    [assigned]
  );

  const selectPlayerForJersey = (jersey: number, userId: string) => {
    setAssigned((prev) => {
      const next = { ...prev };
      // ukloni ako je taj igrac vec negde - menjaj dres
      for (const j of JERSEYS) if (next[j] === userId) next[j] = null;
      next[jersey] = userId;
      return next;
    });
  };

  const clearJersey = (jersey: number) => {
    setAssigned((prev) => ({ ...prev, [jersey]: null }));
  };

  const onSave = async () => {
    if (!info) return;
    const entries = JERSEYS.filter((j) => !!assigned[j]).map((j) => ({
      user_id: assigned[j],
      jersey_number: j,
    }));
    if (entries.length === 0) {
      setErrorMessage('Dodaj bar jednog igraca.');
      return;
    }
    if (entries.length > MAX_ROSTER) {
      setErrorMessage(`Maksimalno ${MAX_ROSTER} igraca.`);
      return;
    }
    setSaving(true);
    setErrorMessage('');
    const { error } = await supabase.rpc('save_match_roster', {
      p_match_id: info.match.id,
      p_club_id: info.club_id,
      p_entries: entries,
    });
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">Utakmica</ThemedText>

      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {info ? (
        <>
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">
              {info.match.home_club_name ?? '-'} vs {info.match.away_club_name ?? '-'}
            </ThemedText>
            <ThemedText>Termin: {formatDate(info.match.scheduled_at)}</ThemedText>
            {info.match.venue ? <ThemedText>Mesto: {info.match.venue}</ThemedText> : null}
            <ThemedText>
              Rezultat:{' '}
              {info.match.home_score != null && info.match.away_score != null
                ? `${info.match.home_score}:${info.match.away_score}`
                : 'nije upisano'}
            </ThemedText>
            <ThemedText style={styles.muted}>
              Tvoj klub: {info.match.side === 'home' ? 'DOMACIN' : 'GOST'}
            </ThemedText>
          </ThemedView>

          <ThemedText type="subtitle">Sastav ({Object.values(assigned).filter(Boolean).length}/12)</ThemedText>
          {!info.can_edit ? (
            <ThemedText style={styles.muted}>
              Utakmica je odigrana ili nemas dozvolu za izmene - prikaz je samo za pregled.
            </ThemedText>
          ) : null}

          {JERSEYS.map((j) => {
            const currentUserId = assigned[j];
            const current = currentUserId
              ? info.players.find((p) => p.user_id === currentUserId)
              : null;
            return (
              <ThemedView key={j} style={styles.jerseyCard}>
                <ThemedText type="defaultSemiBold">Broj #{j}</ThemedText>
                {current ? (
                  <ThemedView style={styles.currentRow}>
                    <ThemedText>{playerName(current)}</ThemedText>
                    {info.can_edit ? (
                      <Pressable style={styles.removeBtn} onPress={() => clearJersey(j)}>
                        <ThemedText style={styles.removeBtnText}>Ukloni</ThemedText>
                      </Pressable>
                    ) : null}
                  </ThemedView>
                ) : (
                  <ThemedText style={styles.muted}>-- prazno --</ThemedText>
                )}

                {info.can_edit ? (
                  <ThemedView style={styles.chipRow}>
                    {info.players.map((p) => {
                      const disabled = !p.is_eligible;
                      const alreadyHere = assigned[j] === p.user_id;
                      const takenElsewhere = !alreadyHere && assignedUserIds.has(p.user_id);
                      return (
                        <Pressable
                          key={`${j}-${p.user_id}`}
                          style={[
                            styles.chip,
                            alreadyHere && styles.chipActive,
                            disabled && styles.chipDisabled,
                            takenElsewhere && styles.chipTaken,
                          ]}
                          disabled={disabled}
                          onPress={() => selectPlayerForJersey(j, p.user_id)}>
                          <ThemedText
                            style={[
                              alreadyHere ? styles.chipActiveText : undefined,
                              disabled ? styles.chipDisabledText : undefined,
                            ]}>
                            {playerName(p)}
                            {p.license_valid_until ? ` • ${p.license_valid_until}` : ' • bez licence'}
                            {takenElsewhere ? ' (zauzet)' : ''}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                    {info.players.length === 0 ? (
                      <ThemedText style={styles.muted}>Nema igraca u klubu.</ThemedText>
                    ) : null}
                  </ThemedView>
                ) : null}
              </ThemedView>
            );
          })}

          {info.can_edit ? (
            <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={onSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.saveBtnText}>Sacuvaj sastav</ThemedText>
              )}
            </Pressable>
          ) : null}

          <ThemedView style={styles.legend}>
            <ThemedText style={styles.muted}>
              Legenda: sivo = neispravna/istekla licenca (ne moze u sastav); tamnije sivo = igrac vec u drugom broju.
            </ThemedText>
            {matchDate ? (
              <ThemedText style={styles.muted}>
                Dan utakmice: {matchDate.toLocaleDateString()}. Licenca mora da vazi do ili posle tog datuma.
              </ThemedText>
            ) : null}
          </ThemedView>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 32 },
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
  muted: { color: '#888' },
  jerseyCard: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  chipActiveText: { color: '#fff', fontWeight: '600' },
  chipDisabled: { backgroundColor: '#eee', borderColor: '#ccc' },
  chipDisabledText: { color: '#aaa' },
  chipTaken: { backgroundColor: '#ddd', borderColor: '#bbb' },
  removeBtn: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  removeBtnText: { color: '#c53939', fontWeight: '600' },
  saveBtn: {
    marginTop: 10,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  legend: { gap: 4, marginTop: 8 },
});
