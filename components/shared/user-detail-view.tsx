import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { openLicensePdf } from '@/lib/license-viewer';
import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  address: string | null;
  phone: string | null;
  created_at?: string | null;
};

type Membership = {
  club_id: number;
  club_name: string;
  member_role: string;
  league_id: number | null;
  league_name: string | null;
  region_id: number | null;
  region_name: string | null;
};

type License = {
  license_number: string | null;
  license_valid_until: string | null;
  license_file_path: string | null;
};

type Payload = {
  profile: Profile | null;
  role: string | null;
  memberships: Membership[];
  license: License | null;
  can_view_sensitive?: boolean;
};

type HubUpcoming = {
  id: number;
  scheduled_at: string;
  venue: string | null;
  status: string;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: 'home' | 'away';
};

type HubPlayed = {
  match_id: number;
  scheduled_at: string;
  home_club_name: string | null;
  away_club_name: string | null;
  home_score: number | null;
  away_score: number | null;
  side: 'home' | 'away';
  jersey_number: number | null;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  total_points: number;
  result: string;
};

type HubAgg = {
  games_played: number;
  total_points: number;
  avg_points: number;
  pts_ft: number;
  pts_2: number;
  pts_3: number;
  fouls: number;
  pct_points_ft: number;
  pct_points_2: number;
  pct_points_3: number;
};

type StatsPayload = {
  authorized: boolean;
  club_id?: number | null;
  league_id?: number | null;
  league_name?: string | null;
  upcoming?: HubUpcoming[];
  played?: HubPlayed[];
  season?: HubAgg;
  career?: HubAgg;
};

export type UserDetailViewProps = {
  userId: string;
  onBack?: () => void;
  showBackButton?: boolean;
};

export function UserDetailView({ userId, onBack, showBackButton = true }: UserDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error } = await supabase.rpc('get_user_detail', { p_user_id: userId });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setStats(null);
      setLoading(false);
      return;
    }
    const payload = (rpcData ?? null) as Payload | null;
    setData(payload);

    if (payload?.role === 'igrac') {
      const { data: statsData, error: statsErr } = await supabase.rpc('get_user_match_stats', {
        p_user_id: userId,
      });
      if (statsErr) {
        setStats({ authorized: false });
      } else {
        setStats((statsData ?? null) as StatsPayload | null);
      }
    } else {
      setStats(null);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const p = data?.profile;
  const lic = data?.license;
  const memberships = data?.memberships ?? [];
  const canViewSensitive = data?.can_view_sensitive ?? false;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {showBackButton && onBack ? (
        <Pressable style={styles.backButton} onPress={onBack}>
          <ThemedText style={styles.backText}>← Nazad</ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="title">
        {p?.display_name || [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.username || 'Korisnik'}
      </ThemedText>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && p ? (
        <>
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Licni podaci</ThemedText>
            <ThemedText>Username: {p.username ?? '-'}</ThemedText>
            <ThemedText>Ime: {p.first_name ?? '-'}</ThemedText>
            <ThemedText>Prezime: {p.last_name ?? '-'}</ThemedText>
            <ThemedText>Uloga: {data?.role ?? '-'}</ThemedText>
            {canViewSensitive ? (
              <>
                <ThemedText>Datum rodjenja: {p.birth_date ?? '-'}</ThemedText>
                <ThemedText>Adresa: {p.address ?? '-'}</ThemedText>
                <ThemedText>Telefon: {p.phone ?? '-'}</ThemedText>
              </>
            ) : (
              <ThemedText style={styles.muted}>
                Licni podaci su dostupni samo klubu korisnika, savezu i delegatu lige.
              </ThemedText>
            )}
          </ThemedView>

          {canViewSensitive ? (
            <ThemedView style={styles.card}>
              <ThemedText type="subtitle">Licenca</ThemedText>
              <ThemedText>Broj licence: {lic?.license_number ?? '-'}</ThemedText>
              <ThemedText>Vazi do: {lic?.license_valid_until ?? '-'}</ThemedText>
              <ThemedText>Fajl: {lic?.license_file_path ?? '-'}</ThemedText>
              {lic?.license_file_path ? (
                <Pressable style={styles.primaryButton} onPress={() => openLicensePdf(lic.license_file_path)}>
                  <ThemedText style={styles.primaryButtonText}>Otvori PDF</ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={styles.muted}>PDF licenca nije uploadovana.</ThemedText>
              )}
            </ThemedView>
          ) : (
            <ThemedView style={styles.card}>
              <ThemedText type="subtitle">Licenca</ThemedText>
              <ThemedText style={styles.muted}>
                Licenca nije vidljiva. Pristup imaju samo klub korisnika, savez i delegat lige.
              </ThemedText>
            </ThemedView>
          )}

          <ThemedText type="subtitle">Clanstvo ({memberships.length})</ThemedText>
          {memberships.length === 0 ? <ThemedText>Nema aktivnih clanstva.</ThemedText> : null}
          {memberships.map((m) => (
            <ThemedView key={`${m.club_id}-${m.member_role}`} style={styles.card}>
              <ThemedText type="defaultSemiBold">{m.club_name}</ThemedText>
              <ThemedText>Uloga u klubu: {m.member_role}</ThemedText>
              <ThemedText>Liga: {m.league_name ?? '-'}</ThemedText>
              <ThemedText>Regija: {m.region_name ?? '-'}</ThemedText>
            </ThemedView>
          ))}

          {data?.role === 'igrac' && stats ? (
            stats.authorized ? (
              <>
                <ThemedText type="subtitle">Odigrane utakmice</ThemedText>
                {(stats.played ?? []).length === 0 ? (
                  <ThemedText>Nema odigranih utakmica.</ThemedText>
                ) : (
                  (stats.played ?? []).map((m) => {
                    const opp = m.side === 'home' ? (m.away_club_name ?? '-') : (m.home_club_name ?? '-');
                    const prefix = m.side === 'home' ? 'vs' : '@';
                    return (
                      <ThemedView key={m.match_id} style={styles.card}>
                        <ThemedText type="defaultSemiBold">
                          {formatDate(m.scheduled_at)} — {prefix} {opp} ({m.result})
                        </ThemedText>
                        <ThemedText>
                          Rezultat: {m.home_score ?? '-'} : {m.away_score ?? '-'}
                        </ThemedText>
                        <ThemedText>Dres: {m.jersey_number != null ? `#${m.jersey_number}` : '-'}</ThemedText>
                        <ThemedText>
                          Poeni: {m.total_points} (+1: {m.pts_ft}, +2: {m.pts_2}, +3: {m.pts_3})
                        </ThemedText>
                        <ThemedText>Licne greske: {m.fouls}</ThemedText>
                      </ThemedView>
                    );
                  })
                )}

                <ThemedText type="subtitle">SEZONA</ThemedText>
                <ThemedView style={styles.card}>
                  <ThemedText>Meceva: {stats.season?.games_played ?? 0}</ThemedText>
                  <ThemedText>Ukupno poena: {stats.season?.total_points ?? 0}</ThemedText>
                  <ThemedText>Prosek po mecu: {stats.season?.avg_points ?? 0}</ThemedText>
                  <ThemedText>
                    +1 / +2 / +3 (broj): {stats.season?.pts_ft ?? 0} / {stats.season?.pts_2 ?? 0} /{' '}
                    {stats.season?.pts_3 ?? 0}
                  </ThemedText>
                  <ThemedText>Licne greske (ukupno): {stats.season?.fouls ?? 0}</ThemedText>
                  <ThemedText>
                    Procenat poena iz +1: {stats.season?.pct_points_ft ?? 0}% · iz +2:{' '}
                    {stats.season?.pct_points_2 ?? 0}% · iz +3: {stats.season?.pct_points_3 ?? 0}%
                  </ThemedText>
                </ThemedView>

                <ThemedText type="subtitle">Karijera</ThemedText>
                <ThemedView style={styles.card}>
                  <ThemedText>Meceva: {stats.career?.games_played ?? 0}</ThemedText>
                  <ThemedText>Ukupno poena: {stats.career?.total_points ?? 0}</ThemedText>
                  <ThemedText>Prosek po mecu: {stats.career?.avg_points ?? 0}</ThemedText>
                  <ThemedText>
                    +1 / +2 / +3 (broj): {stats.career?.pts_ft ?? 0} / {stats.career?.pts_2 ?? 0} /{' '}
                    {stats.career?.pts_3 ?? 0}
                  </ThemedText>
                  <ThemedText>Licne greske (ukupno): {stats.career?.fouls ?? 0}</ThemedText>
                  <ThemedText>
                    Procenat poena iz +1: {stats.career?.pct_points_ft ?? 0}% · iz +2:{' '}
                    {stats.career?.pct_points_2 ?? 0}% · iz +3: {stats.career?.pct_points_3 ?? 0}%
                  </ThemedText>
                </ThemedView>
              </>
            ) : (
              <ThemedView style={styles.card}>
                <ThemedText type="subtitle">Statistika</ThemedText>
                <ThemedText style={styles.muted}>
                  Statistiku ovog igraca mogu da pogledaju samo savez, delegat lige i clanovi klubova iz iste lige.
                </ThemedText>
              </ThemedView>
            )
          ) : null}
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

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 8, padding: 10, gap: 6 },
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
  primaryButton: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
