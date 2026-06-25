import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';

export default function TrenerClanarineScreen() {
  useScreenPullRefresh(useCallback(() => Promise.resolve(), []));

  return (
    <RefreshableScrollView contentContainerStyle={styles.container}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ThemedText style={styles.backText}>← Nazad</ThemedText>
      </Pressable>
      <ThemedText type="title">CLANARINE</ThemedText>
      <ThemedText>Ovde ide evidencija clanarina, status uplata i podsetnici.</ThemedText>
    </RefreshableScrollView>
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
});
