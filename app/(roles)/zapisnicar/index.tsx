import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemeProfileToggle } from '@/components/theme-profile-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type ProfileRow = {
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
  away_club_id: number;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
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
  const [profile, setProfile] = useState<ProfileRow | null>(null);
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

    const [profileRes, matchesRes] = await Promise.all([
      supabase.from('profiles').select('username, display_name, first_name, last_name').eq('id', user.id).maybeSingle(),
      supabase.rpc('get_my_zapisnicar_matches'),
    ]);

    if (profileRes.error) setErrorMessage(profileRes.error.message);
    else setProfile(profileRes.data);

    if (matchesRes.error) setErrorMessage((prev) => prev || matchesRes.error!.message);
    else setMatches((matchesRes.data as MatchRow[]) ?? []);

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Zapisnicar</ThemedText>
      </ThemedView>

      {errorMessage ? (
        <ThemedView style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {profile ? (
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">
            {profile.display_name ||
              [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
              'Zapisnicar'}
          </ThemedText>
          <ThemedText>Username: {profile.username ?? '-'}</ThemedText>
        </ThemedView>
      ) : null}

      <ThemeProfileToggle />

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

      {matches.map((m) => {
        const isLive = m.status === 'live';
        const isFinished = m.status === 'finished';
        return (
          <Pressable
            key={m.id}
            style={[styles.matchCard, isLive && styles.matchCardLive, isFinished && styles.matchCardFinished]}
            onPress={() => router.push(`/zapisnicar/utakmica/${m.id}` as never)}>
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
                {m.status}
              </ThemedText>
            </ThemedText>
            {m.home_score !== null && m.away_score !== null ? (
              <ThemedText>
                Rezultat: {m.home_score} : {m.away_score}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: { color: '#0a7ea4', fontWeight: '600' },
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
  matchCardLive: { borderColor: '#0a7ea4', backgroundColor: '#eef7fb' },
  matchCardFinished: { opacity: 0.6 },
  statusLive: { color: '#0a7ea4', fontWeight: '700' },
  statusFinished: { color: '#666' },
});
