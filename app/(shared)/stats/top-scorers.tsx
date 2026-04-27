import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function TopScorersScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Top Scorers</ThemedText>
      <ThemedText>
        Shared leaderboard ekran. Ovde kasnije ide tabela najboljih strelaca po sezoni/ligi.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    padding: 16,
  },
});
