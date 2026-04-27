import { Link } from 'expo-router';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

const TRAINING_SECTIONS: Array<{ id: string; title: string; description: string; href: string }> = [
  {
    id: 'dodaj-igraca',
    title: 'DODAJ IGRACA',
    description: 'Otvara formu za kreiranje igraca i automatski upis u klub.',
    href: '/trener/dodaj-igraca',
  },
  {
    id: 'tim',
    title: 'TIM',
    description: 'Upravljanje igracima, rosterom i pripadnoscu klubu.',
    href: '/trener/tim',
  },
  {
    id: 'treninzi',
    title: 'TRENINZI',
    description: 'Plan treninga, termini i evidencija prisustva.',
    href: '/trener/treninzi',
  },
  {
    id: 'taktike',
    title: 'TAKTIKE',
    description: 'Kreiranje i deljenje taktika za clanove kluba.',
    href: '/trener/taktike',
  },
  {
    id: 'clanarine',
    title: 'CLANARINE',
    description: 'Evidencija clanarina i status uplata igraca.',
    href: '/trener/clanarine',
  },
  {
    id: 'moja-liga',
    title: 'MOJA LIGA',
    description: 'Pregled svih klubova u tvojoj ligi, njihovih timova i licenci.',
    href: '/trener/moja-liga',
  },
  {
    id: 'takmicenje',
    title: 'TAKMICENJE',
    description: 'Tabela grupe i lista najboljih strelaca u tvojoj ligi.',
    href: '/trener/takmicenje',
  },
] as const;

export default function TrenerHomeScreen() {
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
        <ThemedText type="title">Treninzi</ThemedText>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <ThemedText style={styles.logoutText}>Logout</ThemedText>
        </Pressable>
      </ThemedView>
      <ThemedText>
        Trening tab je organizovan po funkcionalnim sekcijama. Klik otvara poseban ekran.
      </ThemedText>
      <Link href="/home" style={styles.link}>
        Otvori shared home
      </Link>

      {TRAINING_SECTIONS.map((section) => (
        <Pressable key={section.id} style={styles.sectionCard} onPress={() => router.push(section.href)}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">{section.title}</ThemedText>
            <ThemedText style={styles.chevron}>▸</ThemedText>
          </ThemedView>
          <ThemedText>{section.description}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
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
  logoutText: {
    color: '#c53939',
    fontWeight: '600',
  },
  link: { textDecorationLine: 'underline', fontSize: 16 },
  sectionCard: {
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 16,
    opacity: 0.8,
  },
});
