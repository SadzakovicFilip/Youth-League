import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { ScreenShell } from '@/components/screen-shell';
import {
  MatchPublicDetailView,
  type MatchPublicDetailViewHandle,
} from '@/components/shared/match-public-detail-view';
import { ThemedView } from '@/components/themed-view';
import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet } from 'react-native';

export default function SavezUtakmicaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);
  const detailRef = useRef<MatchPublicDetailViewHandle>(null);
  useScreenPullRefresh(
    useCallback(() => detailRef.current?.refresh() ?? Promise.resolve(), []),
  );

  return (
    <ScreenShell>
      <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedView style={styles.card}>
          <MatchPublicDetailView ref={detailRef} matchId={matchId} />
        </ThemedView>
      </RefreshableScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 10, padding: 12, gap: 8 },
});
