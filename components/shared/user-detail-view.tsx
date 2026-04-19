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

export type UserDetailViewProps = {
  userId: string;
  onBack?: () => void;
  showBackButton?: boolean;
};

export function UserDetailView({ userId, onBack, showBackButton = true }: UserDetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error } = await supabase.rpc('get_user_detail', { p_user_id: userId });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setLoading(false);
      return;
    }
    setData((rpcData ?? null) as Payload | null);
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
        </>
      ) : null}
    </ScrollView>
  );
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
