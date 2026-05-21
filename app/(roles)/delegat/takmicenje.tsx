import { ActionAccentHex } from '@/constants/theme';
import { router, useFocusEffect } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { LeagueCompetitionView } from '@/components/shared/league-competition-view';
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
  const [openLeagueId, setOpenLeagueId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const { data, error } = await supabase.rpc('get_delegate_leagues');
    if (error) {
      setErrorMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as LeagueRow[]);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useScreenPullRefresh(load);

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Takmičenje</ThemedText>
      <ThemedText>Pregled tabele, međusobnih utakmica i liste strelaca po ligi.</ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Osveži</ThemedText>
      </Pressable>

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

      {rows.map((r) => {
        const isOpen = openLeagueId === r.league_id;
        return (
          <ThemedView key={r.league_id} style={styles.leagueBlock}>
            <Pressable
              style={[styles.leagueHeader, isOpen && styles.leagueHeaderOpen]}
              onPress={() => {
                setOpenLeagueId((id) => (id === r.league_id ? null : r.league_id));
              }}>
              <ThemedText style={styles.chev}>{isOpen ? '▼' : '▶'}</ThemedText>
              <ThemedView style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold">{r.league_name}</ThemedText>
                <ThemedText style={styles.meta}>
                  {r.region_name ?? '-'} · Grupe: {r.group_count} · Klubovi: {r.club_count}
                </ThemedText>
              </ThemedView>
            </Pressable>

            {isOpen ? (
              <ThemedView style={styles.leagueBody}>
                <LeagueCompetitionView
                  leagueId={r.league_id}
                  onOpenPlayer={(uid, cid) =>
                    router.push(
                      `/delegat/korisnik/${uid}${cid != null ? `?clubId=${cid}` : ''}` as never,
                    )
                  }
                  onOpenClub={(cid) => router.push(`/delegat/klub/${cid}`)}
                />
              </ThemedView>
            ) : null}
          </ThemedView>
        );
      })}
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: ActionAccentHex,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: { color: ActionAccentHex, fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  errorText: { color: '#c53939' },
  leagueBlock: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
    overflow: 'hidden',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  leagueHeaderOpen: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#999' },
  chev: { fontSize: 12, fontWeight: '800', width: 18, textAlign: 'center' },
  meta: { fontSize: 13, opacity: 0.85, marginTop: 2 },
  leagueBody: { padding: 8, gap: 8 },
});
