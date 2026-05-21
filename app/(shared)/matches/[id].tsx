import {
  MatchPublicDetailView,
  type MatchPublicDetailViewHandle,
} from '@/components/shared/match-public-detail-view';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';

export default function MatchDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const detailRef = useRef<MatchPublicDetailViewHandle>(null);
  useScreenPullRefresh(
    useCallback(() => detailRef.current?.refresh() ?? Promise.resolve(), []),
  );

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ThemedText style={styles.backText}>← Nazad</ThemedText>
        </Pressable>
        <ThemedView style={styles.card}>
          <MatchPublicDetailView ref={detailRef} matchId={matchId} />
        </ThemedView>
      </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  back: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  backText: { fontWeight: '600' },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 10, padding: 12, gap: 8 },
});
