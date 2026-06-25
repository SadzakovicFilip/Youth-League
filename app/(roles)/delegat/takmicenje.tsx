import { router, useFocusEffect } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { LeagueCompetitionView } from '@/components/shared/league-competition-view';
import { SearchableSelect, type SelectOption } from '@/components/shared/searchable-select';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type LeagueRow = {
  league_id: number;
  league_name: string;
  region_id: number | null;
  region_name: string | null;
  group_count: number;
  club_count: number;
};

export default function DelegatTakmicenjeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_delegate_leagues');
    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setSelectedLeagueId(null);
      setLoading(false);
      return;
    }
    const next = (data ?? []) as LeagueRow[];
    setRows(next);
    setSelectedLeagueId((prev) => {
      if (next.length === 0) return null;
      if (prev != null && next.some((r) => r.league_id === prev)) return prev;
      return next[0].league_id;
    });
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  const leagueOptions = useMemo<SelectOption[]>(
    () =>
      rows.map((r) => ({
        value: String(r.league_id),
        label: r.league_name,
        sublabel: [
          r.region_name,
          r.group_count != null ? `Grupe: ${r.group_count}` : null,
          r.club_count != null ? `Klubovi: ${r.club_count}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      })),
    [rows],
  );

  const selectedLeague = useMemo(
    () => rows.find((r) => r.league_id === selectedLeagueId) ?? null,
    [rows, selectedLeagueId],
  );

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {loading ? <ActivityIndicator /> : null}
      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && rows.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nisi delegat ni u jednoj ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && rows.length > 0 && selectedLeagueId != null ? (
        <>
          <SearchableSelect
            label="Liga"
            placeholder="Izaberi ligu"
            sheetTitle="Liga"
            value={String(selectedLeagueId)}
            options={leagueOptions}
            clearable={false}
            onChange={(v) => {
              if (v == null) return;
              const id = Number(v);
              if (Number.isFinite(id)) setSelectedLeagueId(id);
            }}
          />

          {selectedLeague ? (
            <LeagueCompetitionView
              key={selectedLeagueId}
              leagueId={selectedLeagueId}
              hideTitle
              onOpenPlayer={(uid, cid) =>
                router.push(
                  `/delegat/korisnik/${uid}${cid != null ? `?clubId=${cid}` : ''}` as never,
                )
              }
              onOpenClub={(cid) => router.push(`/delegat/klub/${cid}`)}
            />
          ) : null}
        </>
      ) : null}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  errorText: { color: '#c53939' },
});
