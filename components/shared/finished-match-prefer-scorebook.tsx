import { useScreenPullRefresh } from '@/contexts/screen-pull-refresh-context';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  MatchScorebookDetailView,
  type MatchScorebookDetailViewHandle,
} from '@/components/match-scorebook-detail-view';
import {
  MatchPublicDetailView,
  type MatchPublicDetailViewHandle,
} from '@/components/shared/match-public-detail-view';
import { ThemedView } from '@/components/themed-view';
import { RefreshableScrollView } from '@/components/refreshable-scroll-view';
import { supabase } from '@/lib/supabase';

type Props = {
  matchId: number;
  /** Izvan zapisnika (npr. zajednička ruta `/matches/…`) — samo kada meč nije u box score režimu. */
  publicTopSlot?: ReactNode;
};

const SCOREBOOK_ROUTE_STATUSES = new Set(['finished', 'live', 'scheduled']);

/** Na finished / live / scheduled prikaži `MatchScorebookDetailView` (box score / zapisnik); inače javni kratki detalj. */
export function FinishedMatchPreferScorebook({ matchId, publicTopSlot = null }: Props) {
  const [checking, setChecking] = useState(true);
  const [showScorebook, setShowScorebook] = useState(false);
  const scoreRef = useRef<MatchScorebookDetailViewHandle>(null);
  const publicRef = useRef<MatchPublicDetailViewHandle>(null);

  const probeFinished = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setShowScorebook(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.from('matches').select('status').eq('id', matchId).maybeSingle();
    const st = String((data as { status?: string } | null)?.status ?? '').toLowerCase();
    setShowScorebook(!error && SCOREBOOK_ROUTE_STATUSES.has(st));
    setChecking(false);
  }, [matchId]);

  useEffect(() => {
    void probeFinished();
  }, [probeFinished]);

  useScreenPullRefresh(
    useCallback(async () => {
      await probeFinished();
      await Promise.all([
        scoreRef.current?.refresh?.() ?? Promise.resolve(),
        publicRef.current?.refresh?.() ?? Promise.resolve(),
      ]);
    }, [probeFinished]),
  );

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (showScorebook) {
    return (
      <View style={styles.fill}>
        <MatchScorebookDetailView ref={scoreRef} matchId={matchId} />
      </View>
    );
  }

  return (
    <RefreshableScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {publicTopSlot}
      <ThemedView style={styles.card}>
        <MatchPublicDetailView ref={publicRef} matchId={matchId} />
      </ThemedView>
    </RefreshableScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { flex: 1, paddingTop: 36, alignItems: 'center' },
  container: { gap: 12, padding: 16, paddingBottom: 32 },
  card: { borderWidth: 1, borderColor: '#666', borderRadius: 10, padding: 12, gap: 8 },
});
