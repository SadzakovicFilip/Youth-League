import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SavezHomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Savez Dashboard</ThemedText>
      <ThemedText>Upravljanje klubovima, delegatima i zapisnicarima.</ThemedText>
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
