import { ActionAccentHex, ActionAccentWash } from '@/constants/theme';
import { router, useFocusEffect } from 'expo-router';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { MatchTimetableCalendar } from '@/components/shared/match-timetable-calendar';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatMatchDisplayStatus, isMatchDisplayLive } from '@/lib/match-display-status';
import { supabase } from '@/lib/supabase';

type MatchRow = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_id: number;
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  display_status?: string | null;
};

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

export default function ZapisnicarHomeScreen() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage('Nema aktivne sesije.');
      setLoading(false);
      return;
    }

    const matchesRes = await supabase.rpc('get_my_zapisnicar_matches');

    if (matchesRes.error) setErrorMessage(matchesRes.error.message);
    else setMatches((matchesRes.data as MatchRow[]) ?? []);

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useScreenPullRefresh(load);

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Zapisnicar</ThemedText>
      </ThemedView>

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText style={styles.mutedLine}>Profil i tema: bočni meni.</ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      <ThemedText type="subtitle">Moje utakmice</ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {!loading && matches.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema dodeljenih utakmica.</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && matches.length > 0 ? (
        <MatchTimetableCalendar
          matches={matches}
          onMatchPress={(m) => router.push(`/zapisnicar/utakmica/${m.id}` as never)}
          renderMatch={(m) => {
            const statusLabel = formatMatchDisplayStatus(m);
            const isLive = isMatchDisplayLive(m);
            const isFinished = statusLabel === 'ZAVRŠENA';
            return (
              <ThemedView
                style={[styles.matchCard, isLive && styles.matchCardLive, isFinished && styles.matchCardFinished]}>
                <ThemedText type="defaultSemiBold">
                  {m.home_club_name ?? '-'} vs {m.away_club_name ?? '-'}
                </ThemedText>
                <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                <ThemedText>
                  Status:{' '}
                  <ThemedText
                    style={[
                      isLive && styles.statusLive,
                      isFinished && styles.statusFinished,
                    ]}>
                    {statusLabel}
                  </ThemedText>
                </ThemedText>
                {m.home_score !== null && m.away_score !== null ? (
                  <ThemedText>
                    Rezultat: {m.home_score} : {m.away_score}
                  </ThemedText>
                ) : null}
              </ThemedView>
            );
          }}
        />
      ) : null}
    </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  mutedLine: { opacity: 0.85, fontSize: 14 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 8, padding: 10 },
  errorText: { color: '#c53939' },
  matchCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  matchCardLive: { borderColor: ActionAccentHex, backgroundColor: ActionAccentWash },
  matchCardFinished: { opacity: 0.6 },
  statusLive: { color: ActionAccentHex, fontWeight: '700' },
  statusFinished: { color: '#666' },
});
