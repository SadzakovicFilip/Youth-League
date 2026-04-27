import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getMyClubContext } from '@/lib/club-context';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';

export default function KlubHomeScreen() {
  const [clubName, setClubName] = useState<string>('Klub');
  const [contextInfo, setContextInfo] = useState<string>('');

  useEffect(() => {
    const loadContext = async () => {
      const { data } = await getMyClubContext();
      if (!data) return;
      setClubName(data.clubName);
      setContextInfo(
        [
          data.regionName ? `Regija: ${data.regionName}` : null,
          data.leagueName ? `Liga: ${data.leagueName}` : null,
          data.groupName ? `Grupa: ${data.groupName}` : null,
        ]
          .filter(Boolean)
          .join(' | ')
      );
    };
    loadContext();
  }, []);

  const onLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Logout greska', error.message);
      return;
    }
    router.replace('/login');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Klub Dashboard</ThemedText>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedText type="subtitle">{clubName}</ThemedText>
      {contextInfo ? <ThemedText>{contextInfo}</ThemedText> : null}
      <ThemedText>Administrativno upravljanje klubom: korisnici, tim, clanarine, licence i utakmice.</ThemedText>

      <ThemedView style={styles.grid}>
        <ActionCard label="Dodaj igraca" onPress={() => router.push('/klub/dodaj-igraca')} />
        <ActionCard label="Dodaj trenera" onPress={() => router.push('/klub/dodaj-trenera')} />
        <ActionCard label="Dodaj zapisnicara" onPress={() => router.push('/klub/dodaj-zapisnicara')} />
        <ActionCard label="Tim i clanarine" onPress={() => router.push('/klub/tim')} />
        <ActionCard label="Utakmice (domacin/gost)" onPress={() => router.push('/klub/utakmice')} />
        <ActionCard label="Moja liga (drugi klubovi)" onPress={() => router.push('/klub/moja-liga')} />
        <ActionCard label="Takmicenje (tabela i strelci)" onPress={() => router.push('/klub/takmicenje')} />
      </ThemedView>
    </ScrollView>
  );
}

type ActionCardProps = {
  label: string;
  onPress: () => void;
};

function ActionCard({ label, onPress }: ActionCardProps) {
  return (
    <Pressable style={styles.actionCard} onPress={onPress}>
      <ThemedText type="defaultSemiBold">{label}</ThemedText>
      <ThemedText style={styles.actionHint}>Otvori</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, padding: 16, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#c53939',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { color: '#c53939', fontWeight: '600' },
  grid: { gap: 8, marginTop: 6 },
  actionCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionHint: { color: '#0a7ea4', fontWeight: '600' },
});
