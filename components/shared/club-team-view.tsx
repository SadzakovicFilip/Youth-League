import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { openLicensePdf } from '@/lib/license-viewer';
import { supabase } from '@/lib/supabase';

type Member = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date?: string | null;
  address?: string | null;
  phone?: string | null;
  license_number?: string | null;
  license_valid_until?: string | null;
  license_file_path?: string | null;
};

type Context = {
  club_id: number;
  club_name: string;
  league_id: number | null;
  league_name: string | null;
  region_id: number | null;
  region_name: string | null;
  group_id: number | null;
  group_name: string | null;
};

type Payload = {
  context: Context | null;
  players: Member[];
  trainers: Member[];
  can_view_sensitive?: boolean;
};

export type ClubTeamViewProps = {
  clubId: number;
  onOpenUser: (userId: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
};

export function ClubTeamView({ clubId, onOpenUser, onBack, showBackButton = true }: ClubTeamViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(clubId)) {
      setErrorMessage('Nevazeci klub.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage('');

    const { data: rpcData, error } = await supabase.rpc('get_club_team_detail', {
      p_club_id: clubId,
    });
    if (error) {
      setErrorMessage(error.message);
      setData(null);
      setLoading(false);
      return;
    }
    setData((rpcData ?? null) as Payload | null);
    setLoading(false);
  }, [clubId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ctx = data?.context ?? null;
  const players = data?.players ?? [];
  const trainers = data?.trainers ?? [];
  const canViewSensitive = data?.can_view_sensitive ?? false;

  const renderMember = (m: Member) => (
    <Pressable key={m.user_id} style={styles.card} onPress={() => onOpenUser(m.user_id)}>
      <ThemedText type="defaultSemiBold">
        {m.display_name || [m.first_name, m.last_name].filter(Boolean).join(' ') || m.username || 'Bez imena'}
      </ThemedText>
      <ThemedText>Username: {m.username ?? '-'}</ThemedText>
      {canViewSensitive ? (
        <>
          <ThemedText>Broj licence: {m.license_number ?? '-'}</ThemedText>
          <ThemedText>Vazi do: {m.license_valid_until ?? '-'}</ThemedText>
          {m.license_file_path ? (
            <Pressable style={styles.secondaryButton} onPress={() => openLicensePdf(m.license_file_path)}>
              <ThemedText style={styles.secondaryButtonText}>Otvori PDF</ThemedText>
            </Pressable>
          ) : (
            <ThemedText style={styles.muted}>PDF licenca nije uploadovana.</ThemedText>
          )}
        </>
      ) : (
        <ThemedText style={styles.muted}>Licenca i licni podaci su dostupni samo klubu, savezu i delegatu lige.</ThemedText>
      )}
      <ThemedText style={styles.hint}>Tap za pun profil ▸</ThemedText>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {showBackButton && onBack ? (
        <Pressable style={styles.backButton} onPress={onBack}>
          <ThemedText style={styles.backText}>← Nazad</ThemedText>
        </Pressable>
      ) : null}

      <ThemedText type="title">{ctx?.club_name ?? 'Klub'}</ThemedText>
      {ctx?.league_name ? <ThemedText>Liga: {ctx.league_name}</ThemedText> : null}
      {ctx?.group_name ? <ThemedText>Grupa: {ctx.group_name}</ThemedText> : null}
      {ctx?.region_name ? <ThemedText>Regija: {ctx.region_name}</ThemedText> : null}

      <Pressable style={styles.refreshButton} onPress={load}>
        <ThemedText style={styles.refreshText}>Refresh</ThemedText>
      </Pressable>

      {loading ? <ActivityIndicator /> : null}

      {errorMessage ? (
        <ThemedView style={styles.card}>
          <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
        </ThemedView>
      ) : null}

      {!loading && !errorMessage ? (
        <>
          <ThemedText type="subtitle">Igraci ({players.length})</ThemedText>
          {players.length === 0 ? <ThemedText>Nema igraca u klubu.</ThemedText> : null}
          {players.map(renderMember)}

          <ThemedText type="subtitle">Treneri ({trainers.length})</ThemedText>
          {trainers.length === 0 ? <ThemedText>Nema trenera u klubu.</ThemedText> : null}
          {trainers.map(renderMember)}
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
  errorText: { color: '#c53939' },
  muted: { color: '#888', fontStyle: 'italic' },
  hint: { color: '#0a7ea4', fontSize: 12 },
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
