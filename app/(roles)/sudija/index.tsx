import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { openLicensePdf } from '@/lib/license-viewer';
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

type TabKey = 'profile' | 'matches';

export default function SudijaHomeScreen() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

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

  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout greska', error.message);
      return;
    }
    router.replace('/login');
  };

  const profile = data?.profile;
  const license = data?.license;
  const leagues = data?.leagues ?? [];
  const matches = data?.matches ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Sudija Dashboard</ThemedText>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedText style={styles.subtitle}>
        Pregled profila i rasporeda utakmica koje su ti dodeljene.
      </ThemedText>

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      <ThemedView style={styles.tabRow}>
        <TabButton label="Profil" active={activeTab === 'profile'} onPress={() => setActiveTab('profile')} />
        <TabButton
          label={`Utakmice (${matches.length})`}
          active={activeTab === 'matches'}
          onPress={() => setActiveTab('matches')}
        />
      </ThemedView>

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

      {!loading && activeTab === 'profile' ? (
        <>
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Licni podaci</ThemedText>
            <ThemedText>
              Ime i prezime:{' '}
              {profile?.display_name ||
                [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
                '-'}
            </ThemedText>
            <ThemedText>Username: {profile?.username ?? '-'}</ThemedText>
            <ThemedText>Datum rodjenja: {profile?.birth_date ?? '-'}</ThemedText>
            <ThemedText>Adresa: {profile?.address ?? '-'}</ThemedText>
            <ThemedText>Telefon: {profile?.phone ?? '-'}</ThemedText>
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Lige ({leagues.length})</ThemedText>
            {leagues.length === 0 ? (
              <ThemedText style={styles.muted}>Nisi jos dodeljen nijednoj ligi.</ThemedText>
            ) : null}
            {leagues.map((l) => (
              <ThemedText key={l.league_id}>
                {l.league_name ?? `Liga #${l.league_id}`}
                {l.region_name ? `  •  ${l.region_name}` : ''}
              </ThemedText>
            ))}
          </ThemedView>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Licenca</ThemedText>
            <ThemedText>Broj licence: {license?.license_number ?? '-'}</ThemedText>
            <ThemedText>Vazi do: {license?.license_valid_until ?? '-'}</ThemedText>
            <ThemedText>Fajl: {license?.license_file_path ?? '-'}</ThemedText>
            {license?.license_file_path ? (
              <Pressable
                style={styles.primaryButton}
                onPress={() => openLicensePdf(license.license_file_path)}>
                <ThemedText style={styles.primaryButtonText}>Otvori PDF</ThemedText>
              </Pressable>
            ) : (
              <ThemedText style={styles.muted}>
                PDF licenca nije uploadovana. Licencu dodaje delegat lige ili savez.
              </ThemedText>
            )}
          </ThemedView>
        </>
      ) : null}

      {!loading && activeTab === 'matches' ? (
        <>
          {matches.length === 0 ? (
            <ThemedView style={styles.card}>
              <ThemedText>Nema dodeljenih utakmica.</ThemedText>
            </ThemedView>
          ) : null}

          {matches.map((m) => {
            const co = m.co_sudije[0];
            const coLabel = co
              ? co.display_name ||
                [co.first_name, co.last_name].filter(Boolean).join(' ') ||
                co.username ||
                '-'
              : null;
            return (
              <ThemedView key={m.id} style={styles.matchCard}>
                <ThemedText type="defaultSemiBold">
                  {m.home_club_name ?? `#${m.home_club_id}`} vs {m.away_club_name ?? `#${m.away_club_id}`}
                </ThemedText>
                <ThemedText>Termin: {formatDate(m.scheduled_at)}</ThemedText>
                {m.league_name ? <ThemedText>Liga: {m.league_name}</ThemedText> : null}
                {m.group_name ? <ThemedText>Grupa: {m.group_name}</ThemedText> : null}
                {m.venue ? <ThemedText>Mesto: {m.venue}</ThemedText> : null}
                <ThemedText>Status: {m.status}</ThemedText>
                {m.home_score !== null && m.away_score !== null ? (
                  <ThemedText>
                    Rezultat: {m.home_score} - {m.away_score}
                  </ThemedText>
                ) : null}
                <ThemedText style={styles.muted}>Kolega: {coLabel ?? 'jos nije dodeljen'}</ThemedText>
              </ThemedView>
            );
          })}
        </>
      ) : null}
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

type TabButtonProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabButton({ label, active, onPress }: TabButtonProps) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <ThemedText style={active ? styles.tabButtonActiveText : undefined}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtitle: { opacity: 0.85 },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { color: '#c53939', fontWeight: '600' },
  refreshButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  refreshText: { fontWeight: '600' },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabButtonActive: { backgroundColor: '#0a7ea4', borderColor: '#0a7ea4' },
  tabButtonActiveText: { color: '#fff' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  matchCard: { borderWidth: 1, borderColor: '#666', borderRadius: 10, padding: 12, gap: 4 },
  muted: { color: '#666', fontStyle: 'italic' },
  errorText: { color: '#c53939' },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
