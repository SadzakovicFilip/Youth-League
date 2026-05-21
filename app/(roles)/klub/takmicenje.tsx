import { router, useFocusEffect } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { LeagueCompetitionView } from '@/components/shared/league-competition-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type Row = {
  league_id: number;
  league_name: string;
  region_id: number | null;
  region_name: string | null;
  club_id: number;
  club_name: string;
  is_my_club: boolean;
};

export default function KlubTakmicenjeScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_my_league_clubs');
    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const leagues = useMemo(() => {
    const map = new Map<number, { league_id: number; league_name: string }>();
    for (const r of rows) {
      if (!map.has(r.league_id)) {
        map.set(r.league_id, { league_id: r.league_id, league_name: r.league_name });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const highlightClubId = useMemo(() => {
    const mine = rows.find((r) => r.is_my_club);
    return mine?.club_id ?? null;
  }, [rows]);

  useScreenPullRefresh(load);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && leagues.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Klub jos nije dodeljen ligi.</ThemedText>
        </ThemedView>
      ) : null}

      {leagues.map((l) => (
        <LeagueCompetitionView
          key={l.league_id}
          leagueId={l.league_id}
          hideTitle
          highlightClubId={highlightClubId}
          onOpenPlayer={(uid, cid) =>
            router.push(
              `/klub/korisnik/${uid}${cid != null ? `?clubId=${cid}` : ''}` as never,
            )
          }
          onOpenClub={(cid) => router.push(`/klub/klub/${cid}`)}
        />
      ))}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 4 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
});
