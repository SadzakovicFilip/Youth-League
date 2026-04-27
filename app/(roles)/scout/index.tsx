import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ScoutHomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Scout Dashboard</ThemedText>
      <ThemedText>Pregled igraca, performance podaci i skauting izvestaji.</ThemedText>
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
