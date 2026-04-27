import { Link } from 'expo-router';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

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
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedView style={styles.headerRow}>
        <ThemedText type="title">Treninzi</ThemedText>
      </ThemedView>
      <ThemedText>
        Trening tab je organizovan po funkcionalnim sekcijama. Klik otvara poseban ekran.
      </ThemedText>
      <Link href="/home" style={styles.link}>
        Otvori shared home
      </Link>

      {TRAINING_SECTIONS.map((section) => (
        <Pressable
          key={section.id}
          style={styles.sectionCard}
          onPress={() => router.push(section.href as never)}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="subtitle">{section.title}</ThemedText>
            <ThemedText style={styles.chevron}>▸</ThemedText>
          </ThemedView>
          <ThemedText>{section.description}</ThemedText>
        </Pressable>
      ))}
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
