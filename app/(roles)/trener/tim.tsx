import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

type PlayerRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

export default function TrenerTimScreen() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [players, setPlayers] = useState<PlayerRow[]>([]);

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

    setPlayers((data ?? []) as PlayerRow[]);
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
              <ThemedText>ID: {player.id}</ThemedText>
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
});
