import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { SearchableSelect, SelectOption } from '@/components/shared/searchable-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type SudijaRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

type AssignedSudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type MatchRow = {
  id: number;
  group_id: number | null;
  group_name: string | null;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  home_club_name: string | null;
  away_club_id: number;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  sudije: AssignedSudija[];
};

export default function DelegatUtakmiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leagueId = Number(id);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [sudije, setSudije] = useState<SudijaRow[]>([]);
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(leagueId)) {
      setErrorMessage('Nevazeca liga.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const [mRes, sRes] = await Promise.all([
      supabase.rpc('get_league_matches', { p_league_id: leagueId }),
      supabase.rpc('get_league_sudije', { p_league_id: leagueId }),
    ]);

    if (mRes.error || sRes.error) {
      setErrorMessage(mRes.error?.message || sRes.error?.message || 'Greska pri ucitavanju.');
      setLoading(false);
      return;
    }

    setMatches(((mRes.data ?? []) as MatchRow[]) || []);
    setSudije(((sRes.data ?? []) as SudijaRow[]) || []);
    setLoading(false);
  }, [leagueId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sudijaOptions = useMemo<SelectOption[]>(() => {
    return sudije.map((s) => ({
      value: s.user_id,
      label:
        s.display_name ||
        [s.first_name, s.last_name].filter(Boolean).join(' ') ||
        s.username ||
        '—',
      sublabel: s.phone ? `@${s.username ?? '-'} · ${s.phone}` : `@${s.username ?? '-'}`,
    }));
  }, [sudije]);

  const onChangeSlot = async (match: MatchRow, slotIndex: 0 | 1, newUserId: string | null) => {
    setSavingMatchId(match.id);
    setErrorMessage('');

    const current = match.sudije[slotIndex]?.user_id ?? null;
    const other = match.sudije[slotIndex === 0 ? 1 : 0]?.user_id ?? null;

    if (newUserId && newUserId === other) {
      setErrorMessage('Isti sudija ne moze biti dodeljen dva puta na istu utakmicu.');
      setSavingMatchId(null);
      return;
    }

    if (current === newUserId) {
      setSavingMatchId(null);
      return;
    }

    if (current) {
      const { error: delErr } = await supabase
        .from('match_officials')
        .delete()
        .eq('match_id', match.id)
        .eq('user_id', current)
        .eq('role', 'sudija');
      if (delErr) {
        setErrorMessage(`Uklanjanje sudije: ${delErr.message}`);
        setSavingMatchId(null);
        return;
      }
    }

    if (newUserId) {
      const { error: insErr } = await supabase.from('match_officials').insert({
        match_id: match.id,
        user_id: newUserId,
        role: 'sudija',
      });
      if (insErr) {
        setErrorMessage(`Dodela sudije: ${insErr.message}`);
        setSavingMatchId(null);
        await load();
        return;
      }
    }

    await load();
    setSavingMatchId(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">Raspored sudija</ThemedText>
      <ThemedText>Dodeli do 2 sudije po utakmici. Slobodno menjaj izbor.</ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && matches.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema zakazanih utakmica u ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {matches.map((m) => {
        const slot0 = m.sudije[0]?.user_id ?? null;
        const slot1 = m.sudije[1]?.user_id ?? null;
        const isBusy = savingMatchId === m.id;

        return (
          <ThemedView key={m.id} style={styles.matchCard}>
            <ThemedText type="defaultSemiBold">
              {m.home_club_name ?? `#${m.home_club_id}`} vs {m.away_club_name ?? `#${m.away_club_id}`}
            </ThemedText>
            <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
            {m.group_name ? <ThemedText>Grupa: {m.group_name}</ThemedText> : null}
            {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
            <ThemedText>Status: {m.status}</ThemedText>
            {m.home_score !== null && m.away_score !== null ? (
              <ThemedText>Rezultat: {m.home_score} - {m.away_score}</ThemedText>
            ) : null}

            <ThemedText style={styles.subLabel}>Sudije</ThemedText>
            <ThemedView style={styles.selectsRow}>
              <SearchableSelect
                label="Sudija 1"
                placeholder="Izaberi sudiju"
                options={sudijaOptions}
                value={slot0}
                disabledValues={slot1 ? [slot1] : []}
                onChange={(v) => onChangeSlot(m, 0, v)}
              />
              <SearchableSelect
                label="Sudija 2"
                placeholder="Izaberi sudiju"
                options={sudijaOptions}
                value={slot1}
                disabledValues={slot0 ? [slot0] : []}
                onChange={(v) => onChangeSlot(m, 1, v)}
              />
            </ThemedView>

            <Pressable
              style={styles.detailButton}
              onPress={() => router.push(`/delegat/utakmica/${m.id}` as never)}>
              <ThemedText style={styles.detailButtonText}>Uslovi i start utakmice →</ThemedText>
            </Pressable>

            {isBusy ? <ActivityIndicator /> : null}
          </ThemedView>
        );
      })}
    </ScrollView>
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

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 40 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10 },
  matchCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  subLabel: { marginTop: 6, fontSize: 12, opacity: 0.8 },
  selectsRow: { flexDirection: 'row', gap: 10 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  detailButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailButtonText: { color: '#0a7ea4', fontWeight: '600' },
});
