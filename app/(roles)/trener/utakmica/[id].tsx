import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

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
  started_at: string | null;
  ended_at: string | null;
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

type ObjectionExisting = {
  id: number;
  reason: string;
  created_at: string;
  status?: 'pending' | 'accepted' | 'rejected' | string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  resolver_display?: string | null;
};

type ObjectionState = {
  is_trener: boolean;
  match_finished: boolean;
  deadline: string | null;
  now: string | null;
  within_window: boolean;
  can_submit: boolean;
  existing: ObjectionExisting | null;
};

type Payload = {
  match: MatchInfo;
  club_id: number;
  can_edit: boolean;
  roster: RosterItem[];
  players: PlayerRow[];
  objection?: ObjectionState | null;
};

const JERSEYS = Array.from({ length: 12 }, (_, i) => i + 4); // 4..15
const MIN_ROSTER = 5;
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

  // Prigovor state
  const [prigovorOpen, setPrigovorOpen] = useState(false);
  const [prigovorText, setPrigovorText] = useState('');
  const [prigovorSaving, setPrigovorSaving] = useState(false);
  const [prigovorError, setPrigovorError] = useState('');
  const [tick, setTick] = useState(0);

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

  // Tikanje sekunde za odbrojavanje prigovora dok je prozor otvoren
  useEffect(() => {
    if (!info?.objection?.deadline) return;
    if (info.objection.existing) return;
    if (!info.objection.match_finished) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [info?.objection?.deadline, info?.objection?.existing, info?.objection?.match_finished]);

  const objectionTimeLeftSec = useMemo(() => {
    void tick;
    const dl = info?.objection?.deadline;
    if (!dl) return 0;
    const ms = new Date(dl).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  }, [info?.objection?.deadline, tick]);

  const formatCountdown = (s: number) => {
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const onSubmitPrigovor = async () => {
    if (!info) return;
    const reason = prigovorText.trim();
    if (reason.length < 3) {
      setPrigovorError('Obrazlozenje je prekratko (min 3 karaktera).');
      return;
    }
    setPrigovorSaving(true);
    setPrigovorError('');
    const { error } = await supabase.rpc('submit_match_objection', {
      p_match_id: info.match.id,
      p_reason: reason,
    });
    setPrigovorSaving(false);
    if (error) {
      setPrigovorError(error.message);
      return;
    }
    setPrigovorOpen(false);
    setPrigovorText('');
    await load();
  };

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
    if (entries.length < MIN_ROSTER) {
      setErrorMessage(`Minimum ${MIN_ROSTER} igraca u sastavu.`);
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

          {info.objection ? (
            <ThemedView style={styles.objectionCard}>
              <ThemedText type="defaultSemiBold">Prigovor na zapisnik</ThemedText>
              {info.objection.existing ? (
                <ThemedView style={styles.objectionDone}>
                  <ThemedText>Prigovor podnet: {formatDate(info.objection.existing.created_at)}</ThemedText>
                  <ThemedText style={styles.muted}>{info.objection.existing.reason}</ThemedText>
                  {(() => {
                    const st = info.objection.existing?.status ?? 'pending';
                    if (st === 'pending') {
                      return (
                        <ThemedText style={styles.objectionPending}>
                          Odluka delegata: na cekanju.
                        </ThemedText>
                      );
                    }
                    if (st === 'accepted') {
                      return (
                        <ThemedView style={styles.objectionDecisionBox}>
                          <ThemedText style={styles.objectionAccepted}>
                            Odluka delegata: USVOJEN prigovor na zapisnik.
                          </ThemedText>
                          {info.objection.existing.resolved_at ? (
                            <ThemedText style={styles.muted}>
                              Datum odluke: {formatDate(info.objection.existing.resolved_at)}
                              {info.objection.existing.resolver_display
                                ? ` · ${info.objection.existing.resolver_display}`
                                : ''}
                            </ThemedText>
                          ) : null}
                        </ThemedView>
                      );
                    }
                    return (
                      <ThemedView style={styles.objectionDecisionBox}>
                        <ThemedText style={styles.objectionRejected}>
                          Odluka delegata: ODBIJEN prigovor na zapisnik.
                        </ThemedText>
                        {info.objection.existing.resolved_at ? (
                          <ThemedText style={styles.muted}>
                            Datum odluke: {formatDate(info.objection.existing.resolved_at)}
                            {info.objection.existing.resolver_display
                              ? ` · ${info.objection.existing.resolver_display}`
                              : ''}
                          </ThemedText>
                        ) : null}
                      </ThemedView>
                    );
                  })()}
                </ThemedView>
              ) : info.objection.match_finished ? (
                info.objection.is_trener ? (
                  info.objection.within_window ? (
                    <>
                      <ThemedText style={styles.muted}>
                        Rok za prigovor istice za {formatCountdown(objectionTimeLeftSec)}.
                      </ThemedText>
                      {!prigovorOpen ? (
                        <Pressable style={styles.prigovorBtn} onPress={() => setPrigovorOpen(true)}>
                          <ThemedText style={styles.prigovorBtnText}>PRIGOVOR</ThemedText>
                        </Pressable>
                      ) : (
                        <ThemedView style={styles.prigovorForm}>
                          <TextInput
                            style={styles.prigovorInput}
                            placeholder="Obrazlozenje prigovora..."
                            placeholderTextColor="#999"
                            value={prigovorText}
                            onChangeText={setPrigovorText}
                            multiline
                            numberOfLines={5}
                            editable={!prigovorSaving}
                          />
                          {prigovorError ? (
                            <ThemedText style={styles.errorText}>{prigovorError}</ThemedText>
                          ) : null}
                          <ThemedView style={styles.prigovorRow}>
                            <Pressable
                              style={[styles.cancelBtn, prigovorSaving && styles.saveBtnDisabled]}
                              onPress={() => {
                                setPrigovorOpen(false);
                                setPrigovorText('');
                                setPrigovorError('');
                              }}
                              disabled={prigovorSaving}>
                              <ThemedText style={styles.cancelBtnText}>Odustani</ThemedText>
                            </Pressable>
                            <Pressable
                              style={[styles.submitBtn, prigovorSaving && styles.saveBtnDisabled]}
                              onPress={onSubmitPrigovor}
                              disabled={prigovorSaving}>
                              {prigovorSaving ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <ThemedText style={styles.submitBtnText}>POSALJI PRIGOVOR</ThemedText>
                              )}
                            </Pressable>
                          </ThemedView>
                        </ThemedView>
                      )}
                    </>
                  ) : (
                    <ThemedText style={styles.muted}>
                      Rok od 30 minuta za podnosenje prigovora je istekao. Smatra se da nemate prigovora na zapisnik.
                    </ThemedText>
                  )
                ) : (
                  <ThemedText style={styles.muted}>
                    Samo trener kluba ucesnika moze da podnese prigovor.
                  </ThemedText>
                )
              ) : (
                <ThemedText style={styles.muted}>
                  Prigovor moze da se podnese tek nakon zavrsetka utakmice (30 minuta).
                </ThemedText>
              )}
            </ThemedView>
          ) : null}

          <ThemedText type="subtitle">Sastav ({Object.values(assigned).filter(Boolean).length}/12)</ThemedText>
          <ThemedText style={styles.muted}>
            Minimum {MIN_ROSTER}, maksimum {MAX_ROSTER} igraca u sastavu.
          </ThemedText>
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
  objectionCard: {
    borderWidth: 1,
    borderColor: '#c58939',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    backgroundColor: '#fff8ee',
  },
  objectionDone: { gap: 6 },
  objectionPending: { marginTop: 4, fontWeight: '600', color: '#856404' },
  objectionDecisionBox: { marginTop: 6, gap: 4 },
  objectionAccepted: { fontWeight: '700', color: '#1b6b2d' },
  objectionRejected: { fontWeight: '700', color: '#8b1a1a' },
  prigovorBtn: {
    backgroundColor: '#c58939',
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  prigovorBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 1 },
  prigovorForm: { gap: 8 },
  prigovorInput: {
    borderWidth: 1,
    borderColor: '#c58939',
    borderRadius: 8,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#000',
    backgroundColor: '#fff',
  },
  prigovorRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: { fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700' },
});
