import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SharedHomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Shared Home</ThemedText>
      <ThemedText>
        Ovaj ekran je zajednicki sloj za stvari koje treba da budu dostupne svim rolama.
      </ThemedText>

      <Link href="/stats/top-scorers" style={styles.link}>
        Top scorers
      </Link>
      <Link href="/matches/sample-match" style={styles.link}>
        Primer detalja utakmice
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
    padding: 16,
  },
  link: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
