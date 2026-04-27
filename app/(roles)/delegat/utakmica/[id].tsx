import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Conditions = {
  match_id: number;
  status: 'scheduled' | 'live' | 'finished' | string;
  started_at: string | null;
  ended_at: string | null;
  scheduled_at: string;
  home_roster_count: number;
  away_roster_count: number;
  sudije_count: number;
  zapisnicar_count: number;
  min_roster?: number;
  max_roster?: number;
  cond_rosters: boolean;
  cond_sudije: boolean;
  cond_zapisnicar: boolean;
  cond_time: boolean;
};

type OfficialRef = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type MatchInfo = {
  id: number;
  league_id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
};

type MatchObjection = {
  id: number;
  club_id: number;
  club_name: string | null;
  reason: string;
  created_at: string;
  created_by: string;
  submitter_display: string | null;
  status: 'pending' | 'accepted' | 'rejected' | string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolver_display: string | null;
};

type Payload = {
  match: MatchInfo;
  conditions: Conditions;
  sudije: OfficialRef[];
  zapisnicar: OfficialRef | null;
  objections?: MatchObjection[];
};

function officialLabel(o: OfficialRef | null | undefined) {
  if (!o) return '—';
  return (
    o.display_name ||
    [o.first_name, o.last_name].filter(Boolean).join(' ') ||
    o.username ||
    'Korisnik'
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function DelegatMatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [objectionBusyId, setObjectionBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage('Neispravan ID utakmice');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const { data: rpcData, error } = await supabase.rpc('get_delegat_match_detail', {
      p_match_id: matchId,
    });
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    setData(rpcData as Payload);
    setLoading(false);
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startMatch = async () => {
    setBusy(true);
    setErrorMessage('');
    const { error } = await supabase.rpc('start_match', { p_match_id: matchId });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  };

  const endMatch = async () => {
    setBusy(true);
    setErrorMessage('');
    const { error } = await supabase.rpc('end_match', { p_match_id: matchId });
    setBusy(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  };

  const resolveObjection = async (objectionId: number, resolution: 'accepted' | 'rejected') => {
    setObjectionBusyId(objectionId);
    setErrorMessage('');
    const { error } = await supabase.rpc('resolve_match_objection', {
      p_objection_id: objectionId,
      p_resolution: resolution,
    });
    setObjectionBusyId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await load();
  };

  const c = data?.conditions;
  const allOk =
    !!c && c.cond_rosters && c.cond_sudije && c.cond_zapisnicar && c.cond_time;
  const isLive = c?.status === 'live';
  const isFinished = c?.status === 'finished';

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

      {data ? (
        <>
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">
              {data.match.home_club_name ?? '-'} vs {data.match.away_club_name ?? '-'}
            </ThemedText>
            <ThemedText>Termin: {formatDate(data.match.scheduled_at)}</ThemedText>
            {data.match.venue ? <ThemedText>Mesto: {data.match.venue}</ThemedText> : null}
            <ThemedText>
              Status:{' '}
              <ThemedText
                style={[
                  isLive && styles.statusLive,
                  isFinished && styles.statusFinished,
                ]}>
                {data.match.status}
              </ThemedText>
            </ThemedText>
            {data.match.home_score !== null && data.match.away_score !== null ? (
              <ThemedText>
                Rezultat: {data.match.home_score} : {data.match.away_score}
              </ThemedText>
            ) : null}
            {data.match.started_at ? (
              <ThemedText style={styles.muted}>Pocela: {formatDate(data.match.started_at)}</ThemedText>
            ) : null}
            {data.match.ended_at ? (
              <ThemedText style={styles.muted}>Zavrsena: {formatDate(data.match.ended_at)}</ThemedText>
            ) : null}
          </ThemedView>

          <ThemedText type="subtitle">Uslovi za pocetak</ThemedText>

          <ConditionRow
            ok={c!.cond_rosters}
            label={`Sastavi oba tima (${c!.min_roster ?? 5}-${c!.max_roster ?? 12} igraca) — ${c!.home_roster_count}/${c!.max_roster ?? 12} : ${c!.away_roster_count}/${c!.max_roster ?? 12}`}
          />
          <ConditionRow
            ok={c!.cond_sudije}
            label={`Dodeljene 2 sudije — ${c!.sudije_count}/2`}
          />
          <ConditionRow
            ok={c!.cond_zapisnicar}
            label={`Dodeljen zapisnicar — ${c!.zapisnicar_count}/1`}
          />
          <ConditionRow
            ok={c!.cond_time}
            label={`Vreme pocetka (${formatDate(c!.scheduled_at)}) je prosao`}
          />

          {data.sudije.length > 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText type="defaultSemiBold">Sudije</ThemedText>
              {data.sudije.map((s) => (
                <ThemedText key={s.user_id}>• {officialLabel(s)}</ThemedText>
              ))}
            </ThemedView>
          ) : null}
          {data.zapisnicar ? (
            <ThemedView style={styles.card}>
              <ThemedText type="defaultSemiBold">Zapisnicar</ThemedText>
              <ThemedText>• {officialLabel(data.zapisnicar)}</ThemedText>
            </ThemedView>
          ) : null}

          {isFinished ? (
            <ThemedView style={styles.card}>
              <ThemedText>Utakmica je zavrsena.</ThemedText>
            </ThemedView>
          ) : null}

          <ThemedText type="subtitle">Prigovori na zapisnik</ThemedText>
          {data.objections && data.objections.length > 0 ? (
            data.objections.map((o) => (
              <ThemedView key={o.id} style={styles.objectionCard}>
                <ThemedText type="defaultSemiBold">{o.club_name ?? `Klub #${o.club_id}`}</ThemedText>
                <ThemedText style={styles.muted}>
                  Podneo: {o.submitter_display ?? '—'} · {formatDate(o.created_at)}
                </ThemedText>
                <ThemedText style={styles.objectionReason}>{o.reason}</ThemedText>
                <ThemedText
                  style={[
                    styles.objectionStatus,
                    o.status === 'pending' && styles.statusPending,
                    o.status === 'accepted' && styles.statusAccepted,
                    o.status === 'rejected' && styles.statusRejected,
                  ]}>
                  Status:{' '}
                  {o.status === 'pending'
                    ? 'NA CEKANJU'
                    : o.status === 'accepted'
                      ? 'USVOJEN'
                      : o.status === 'rejected'
                        ? 'ODBIJEN'
                        : String(o.status).toUpperCase()}
                </ThemedText>
                {o.resolved_at ? (
                  <ThemedText style={styles.muted}>
                    Odluka: {formatDate(o.resolved_at)}
                    {o.resolver_display ? ` · ${o.resolver_display}` : ''}
                  </ThemedText>
                ) : null}
                {o.status === 'pending' ? (
                  objectionBusyId === o.id ? (
                    <ActivityIndicator style={{ marginTop: 8 }} />
                  ) : (
                    <ThemedView style={styles.objectionBtnRow}>
                      <Pressable
                        style={[styles.acceptBtn, busy && styles.primaryBtnDisabled]}
                        onPress={() => resolveObjection(o.id, 'accepted')}
                        disabled={busy}>
                        <ThemedText style={styles.primaryBtnText}>USVOJI</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.rejectObjBtn, busy && styles.primaryBtnDisabled]}
                        onPress={() => resolveObjection(o.id, 'rejected')}
                        disabled={busy}>
                        <ThemedText style={styles.primaryBtnText}>ODBIJ</ThemedText>
                      </Pressable>
                    </ThemedView>
                  )
                ) : null}
              </ThemedView>
            ))
          ) : (
            <ThemedText style={styles.muted}>Nema podnetih prigovora za ovu utakmicu.</ThemedText>
          )}

          {!isFinished && !isLive ? (
            <Pressable
              style={[styles.primaryBtn, (!allOk || busy) && styles.primaryBtnDisabled]}
              onPress={startMatch}
              disabled={!allOk || busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryBtnText}>POCNI UTAKMICU</ThemedText>}
            </Pressable>
          ) : null}

          {isLive ? (
            <Pressable
              style={[styles.dangerBtn, busy && styles.primaryBtnDisabled]}
              onPress={endMatch}
              disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.primaryBtnText}>KRAJ UTAKMICE</ThemedText>}
            </Pressable>
          ) : null}

          {!allOk && !isLive && !isFinished ? (
            <ThemedText style={styles.muted}>
              Dugme POCNI UTAKMICU se omogucuje kada su ispunjeni svi uslovi.
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function ConditionRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <ThemedView style={[styles.condRow, ok ? styles.condOk : styles.condNok]}>
      <ThemedText style={styles.condMark}>{ok ? '✓' : '✗'}</ThemedText>
      <ThemedText style={styles.condLabel}>{label}</ThemedText>
    </ThemedView>
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
  statusLive: { color: '#0a7ea4', fontWeight: '700' },
  statusFinished: { color: '#666' },
  condRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  condOk: { borderColor: '#2a9d4a', backgroundColor: '#eaf7ed' },
  condNok: { borderColor: '#c53939', backgroundColor: '#fbeaea' },
  condMark: { fontWeight: '800', fontSize: 18 },
  condLabel: { flex: 1 },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dangerBtn: {
    marginTop: 10,
    backgroundColor: '#c53939',
    borderRadius: 8,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectionCard: {
    borderWidth: 1,
    borderColor: '#c58939',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    backgroundColor: '#fffaf2',
  },
  objectionReason: { marginTop: 4 },
  objectionStatus: { fontWeight: '700', marginTop: 4 },
  statusPending: { color: '#856404' },
  statusAccepted: { color: '#1b6b2d' },
  statusRejected: { color: '#8b1a1a' },
  objectionBtnRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptBtn: {
    flex: 1,
    backgroundColor: '#2a9d4a',
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectObjBtn: {
    flex: 1,
    backgroundColor: '#c53939',
    borderRadius: 8,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
