import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SpectatorHomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Spectator Dashboard</ThemedText>
      <ThemedText>Pregled rezultata, statistika i javnog sadrzaja.</ThemedText>
      <Link href="/home" style={styles.link}>
        Otvori shared home
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10, padding: 16 },
  link: { textDecorationLine: 'underline', fontSize: 16 },
});
