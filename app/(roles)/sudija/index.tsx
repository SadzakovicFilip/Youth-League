import { router } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatMatchDisplayStatus } from '@/lib/match-display-status';
import { supabase } from '@/lib/supabase';

type CoSudija = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type MatchRow = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  home_club_name: string | null;
  away_club_id: number;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  league_id: number | null;
  league_name: string | null;
  group_id: number | null;
  group_name: string | null;
  co_sudije: CoSudija[];
  display_status?: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
};

type License = {
  license_number: string | null;
  license_valid_until: string | null;
  license_file_path: string | null;
};

type LeagueRow = {
  league_id: number;
  league_name: string | null;
  region_id: number | null;
  region_name: string | null;
};

type DashboardPayload = {
  profile: Profile | null;
  license: License | null;
  leagues: LeagueRow[];
  matches: MatchRow[];
};

export default function SudijaHomeScreen() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error } = await supabase.rpc('get_sudija_dashboard');
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setLoading(false);
      return;
    }
    setData((rpcData ?? null) as DashboardPayload | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const matches = data?.matches ?? [];

  useScreenPullRefresh(load);

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Sudija Dashboard</ThemedText>
      </ThemedView>
      <ThemedText style={styles.subtitle}>
        Raspored utakmica koje su ti dodeljene. Profil i licenca su u bočnom meniju.
      </ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      {loading ? (
        <ThemedView style={styles.card}>
          <ActivityIndicator />
        </ThemedView>
      ) : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading ? (
        <>
          {matches.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Nema dodeljenih utakmica.</ThemedText>
            </ThemedView>
          ) : (
            <MatchTimetableCalendar
              matches={matches}
              onMatchPress={(m) => router.push(`/sudija/utakmica/${m.id}` as never)}
              renderMatch={(m) => {
                const co = m.co_sudije[0];
                const coLabel = co
                  ? co.display_name ||
                    [co.first_name, co.last_name].filter(Boolean).join(' ') ||
                    co.username ||
                    '-'
                  : null;
                return (
                  <ThemedView style={styles.matchCard}>
                    <ThemedText type="defaultSemiBold">
                      {m.home_club_name ?? `#${m.home_club_id}`} vs {m.away_club_name ?? `#${m.away_club_id}`}
                    </ThemedText>
                    <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                    {m.league_name ? <ThemedText>Liga: {m.league_name}</ThemedText> : null}
                    {m.group_name ? <ThemedText>Grupa: {m.group_name}</ThemedText> : null}
                    {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                    <ThemedText>Status: {formatMatchDisplayStatus(m)}</ThemedText>
                    {m.home_score !== null && m.away_score !== null ? (
                      <ThemedText>
                        Rezultat: {m.home_score} - {m.away_score}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={styles.muted}>Kolega: {coLabel ?? 'jos nije dodeljen'}</ThemedText>
                  </ThemedView>
                );
              }}
            />
          )}
        </>
      ) : null}
    </RefreshableScrollView>
    </ScreenShell>
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
  container: { gap: 10, padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { opacity: 0.85 },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  refreshText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  matchCard: { borderWidth: 1, borderColor: '#666', borderRadius: 10, padding: 12, gap: 4 },
  muted: { color: '#666', fontStyle: 'italic' },
  errorText: { color: '#c53939' },
});
