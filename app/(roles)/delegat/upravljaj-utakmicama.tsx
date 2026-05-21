import { ActionAccentHex } from '@/constants/theme';
import { router, useFocusEffect } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
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
  league_id: number;
  league_name: string | null;
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

type LeagueRow = {
  league_id: number;
  league_name: string;
};

function sudijeToOptions(sudije: SudijaRow[]): SelectOption[] {
  return sudije.map((s) => ({
    value: s.user_id,
    label:
      s.display_name ||
      [s.first_name, s.last_name].filter(Boolean).join(' ') ||
      s.username ||
      '—',
    sublabel: s.phone ? `@${s.username ?? '-'} · ${s.phone}` : `@${s.username ?? '-'}`,
  }));
}

export default function DelegatUpravljajUtakmicamaScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [sudijeByLeague, setSudijeByLeague] = useState<Map<number, SudijaRow[]>>(new Map());
  const [savingMatchId, setSavingMatchId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data: leagueRows, error: leagueErr } = await supabase.rpc('get_delegate_leagues');
    if (leagueErr) {
      setErrorMessage(leagueErr.message);
      setMatches([]);
      setSudijeByLeague(new Map());
      setLoading(false);
      return;
    }

    const leagues = ((leagueRows ?? []) as LeagueRow[]) || [];
    if (leagues.length === 0) {
      setMatches([]);
      setSudijeByLeague(new Map());
      setLoading(false);
      return;
    }

    const results = await Promise.all(
      leagues.map(async (L) => {
        const [mRes, sRes] = await Promise.all([
          supabase.rpc('get_league_matches', { p_league_id: L.league_id }),
          supabase.rpc('get_league_sudije', { p_league_id: L.league_id }),
        ]);
        return {
          league_id: L.league_id,
          league_name: L.league_name,
          matches: (mRes.data ?? []) as Omit<MatchRow, 'league_id' | 'league_name'>[],
          sudije: (sRes.data ?? []) as SudijaRow[],
          err: mRes.error?.message || sRes.error?.message || null,
        };
      }),
    );

    const err = results.find((r) => r.err);
    if (err?.err) {
      setErrorMessage(err.err);
      setMatches([]);
      setSudijeByLeague(new Map());
      setLoading(false);
      return;
    }

    const merged: MatchRow[] = [];
    const sudMap = new Map<number, SudijaRow[]>();
    for (const r of results) {
      sudMap.set(r.league_id, r.sudije);
      for (const m of r.matches) {
        merged.push({
          ...m,
          league_id: r.league_id,
          league_name: r.league_name,
        });
      }
    }
    setSudijeByLeague(sudMap);
    setMatches(merged);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const optionsForLeague = useCallback(
    (leagueId: number) => sudijeToOptions(sudijeByLeague.get(leagueId) ?? []),
    [sudijeByLeague],
  );

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

  useScreenPullRefresh(load);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Upravljaj utakmicama</ThemedText>
      <ThemedText>
        Kalendar svih utakmica u ligama gde si delegat. Dodeli sudije i otvori detalj utakmice.
      </ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Osveži</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && matches.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema zakazanih utakmica u tvojim ligama.</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && matches.length > 0 ? (
        <MatchTimetableCalendar
          matches={matches}
          onMatchPress={(m) => router.push(`/delegat/utakmica/${m.id}` as never)}
          renderMatch={(m) => {
            const opts = optionsForLeague(m.league_id);
            const slot0 = m.sudije[0]?.user_id ?? null;
            const slot1 = m.sudije[1]?.user_id ?? null;
            const isBusy = savingMatchId === m.id;

            return (
              <ThemedView style={styles.matchCard}>
                <ThemedText style={styles.leagueTag}>{m.league_name ?? `Liga #${m.league_id}`}</ThemedText>
                <ThemedText type="defaultSemiBold">
                  {m.home_club_name ?? `#${m.home_club_id}`} vs {m.away_club_name ?? `#${m.away_club_id}`}
                </ThemedText>
                <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                {m.group_name ? <ThemedText>Grupa: {m.group_name}</ThemedText> : null}
                {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                <ThemedText>Status: {m.status}</ThemedText>
                {m.home_score !== null && m.away_score !== null ? (
                  <ThemedText>
                    Rezultat: {m.home_score} - {m.away_score}
                  </ThemedText>
                ) : null}

                <ThemedText style={styles.subLabel}>Sudije</ThemedText>
                <ThemedView style={styles.selectsRow}>
                  <SearchableSelect
                    label="Sudija 1"
                    placeholder="Izaberi sudiju"
                    options={opts}
                    value={slot0}
                    disabledValues={slot1 ? [slot1] : []}
                    onChange={(v) => onChangeSlot(m, 0, v)}
                  />
                  <SearchableSelect
                    label="Sudija 2"
                    placeholder="Izaberi sudiju"
                    options={opts}
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
          }}
        />
      ) : null}
    </RefreshableScrollView>
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
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: { color: ActionAccentHex, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10 },
  matchCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  leagueTag: { fontSize: 12, fontWeight: '700', opacity: 0.85 },
  subLabel: { marginTop: 6, fontSize: 12, opacity: 0.8 },
  selectsRow: { flexDirection: 'row', gap: 10 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  detailButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailButtonText: { color: ActionAccentHex, fontWeight: '600' },
});
