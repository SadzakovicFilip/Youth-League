import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { openLicensePdf } from '@/lib/license-viewer';
import { supabase } from '@/lib/supabase';

type PlayerRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

type LicenseRow = {
  user_id: string;
  valid_until?: string | null;
  license_valid_until?: string | null;
  license_file_path: string | null;
  license_number: string | null;
};

type PlayerWithLicense = PlayerRow & {
  license_valid_until: string | null;
  license_file_path: string | null;
  license_number: string | null;
};

export default function TrenerTimScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [players, setPlayers] = useState<PlayerWithLicense[]>([]);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc('get_my_team_players');

    if (error) {
      setErrorMessage(error.message);
      setPlayers([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as PlayerRow[];
    const ids = rows.map((r) => r.id);

    let licenseMap = new Map<string, LicenseRow>();
    if (ids.length > 0) {
      const { data: lics, error: licErr } = await supabase
        .from('user_licenses')
        .select('user_id, valid_until, license_valid_until, license_file_path, license_number')
        .in('user_id', ids);

      if (!licErr && lics) {
        licenseMap = new Map(lics.map((l: LicenseRow) => [l.user_id, l]));
      }
    }

    const enriched: PlayerWithLicense[] = rows.map((r) => {
      const lic = licenseMap.get(r.id);
      return {
        ...r,
        license_valid_until: lic?.license_valid_until ?? lic?.valid_until ?? null,
        license_file_path: lic?.license_file_path ?? null,
        license_number: lic?.license_number ?? null,
      };
    });

    setPlayers(enriched);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTeam();
    }, [loadTeam])
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">TIM</ThemedText>
      <ThemedText>Lista svih igraca iz klubova u kojima je trenutni korisnik trener.</ThemedText>
      <Pressable style={styles.refreshButton} onPress={loadTeam}>
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

      {!loading && !errorMessage && players.length === 0 ? (
        <ThemedView style={styles.card}>
          <ThemedText>Nema igraca u klubovima ovog trenera.</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage && players.length > 0
        ? players.map((player) => (
            <ThemedView key={player.id} style={styles.card}>
              <ThemedText type="subtitle">
                {player.display_name || [player.first_name, player.last_name].filter(Boolean).join(' ') || 'Bez imena'}
              </ThemedText>
              <ThemedText>Username: {player.username ?? '-'}</ThemedText>
              <ThemedText>Broj licence: {player.license_number ?? '-'}</ThemedText>
              <ThemedText>Licenca vazi do: {player.license_valid_until ?? '-'}</ThemedText>
              {player.license_file_path ? (
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => openLicensePdf(player.license_file_path)}>
                  <ThemedText style={styles.secondaryButtonText}>Otvori PDF</ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={styles.muted}>PDF licenca nije uploadovana.</ThemedText>
              )}
            </ThemedView>
          ))
        : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 16,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: {
    fontWeight: '600',
  },
  refreshButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  refreshText: {
    color: '#0a7ea4',
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 6,
  },
  errorText: {
    color: '#c53939',
  },
  muted: { color: '#888', fontStyle: 'italic' },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryButtonText: { color: '#0a7ea4', fontWeight: '600' },
});
