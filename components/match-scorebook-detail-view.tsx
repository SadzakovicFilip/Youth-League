/**
 * Orkestrator: učitava `get_zapisnicar_match_detail`, zatim
 * - finished → `MatchFinishedBoxScoreView` (final),
 * - live + can_score → `MatchScorebookLiveView`,
 * - live/scheduled bez can_score → isti box score kao završnica (bedž UŽIVO / ZAKAZANO).
 *
 * Uživo: flash animacija na kos/faul; glavni rezultat se menja tek posle animacije (2,5 s).
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  MatchFinishedBoxScoreView,
  type MatchBoxScoreVariant,
} from '@/components/match-finished-box-score-view';
import { MatchScoreEventFlash } from '@/components/match-score-event-flash';
import { MatchScorebookLiveView } from '@/components/match-scorebook-live-view';
import type { MatchScorebookPayload } from '@/components/match-scorebook-types';
import {
  useMatchScorebookRealtime,
  type MatchEventInsertRow,
} from '@/hooks/use-match-scorebook-realtime';
import {
  buildScoreFlashPayload,
  type MatchScoreFlashEventType,
  type MatchScoreFlashPayload,
} from '@/lib/match-score-flash-label';
import { normalizeLiveScorebookPayload } from '@/lib/match-scorebook-normalize';
export type {
  MatchScorebookDetailMatchInfo,
  MatchScorebookPayload,
  MatchScorebookRosterPlayer,
} from '@/components/match-scorebook-types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';

export type MatchScorebookDetailViewHandle = {
  refresh: () => Promise<void>;
};

export type MatchScorebookDetailViewProps = {
  matchId: number;
  topAccessory?: ReactNode;
  /** Ispod hero kartice u box score-u (samo finished). */
  boxScoreBelowHero?: ReactNode;
  onAfterReload?: () => void | Promise<void>;
};

function isFinishedStatus(status: string | null | undefined) {
  return String(status ?? '').toLowerCase() === 'finished';
}

function readOnlyBoxVariant(status: string | null | undefined): MatchBoxScoreVariant {
  const st = String(status ?? '').toLowerCase();
  if (st === 'scheduled') return 'scheduled';
  return 'live';
}

function isScoreFlashEventType(v: string): v is MatchScoreFlashEventType {
  return v === 'free_throw' || v === 'field' || v === 'three' || v === 'foul';
}

export const MatchScorebookDetailView = forwardRef<
  MatchScorebookDetailViewHandle,
  MatchScorebookDetailViewProps
>(function MatchScorebookDetailView(
  { matchId, topAccessory = null, boxScoreBelowHero = null, onAfterReload },
  ref,
) {
  const [serverData, setServerData] = useState<MatchScorebookPayload | null>(null);
  const [presentedData, setPresentedData] = useState<MatchScorebookPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [flash, setFlash] = useState<MatchScoreFlashPayload | null>(null);

  const onAfterReloadRef = useRef(onAfterReload);
  onAfterReloadRef.current = onAfterReload;

  const flashActiveRef = useRef(false);
  const blockScoreOnlyReloadRef = useRef(false);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const loadQueuedRef = useRef(false);
  const pendingApplyRef = useRef(false);
  const suppressedInsertRef = useRef<{ userId: string; eventType: string; at: number } | null>(
    null,
  );
  const rosterRef = useRef<{ home: MatchScorebookPayload['home_roster']; away: MatchScorebookPayload['away_roster'] }>({
    home: [],
    away: [],
  });

  if (presentedData) {
    rosterRef.current = {
      home: presentedData.home_roster,
      away: presentedData.away_roster,
    };
  } else if (serverData) {
    rosterRef.current = {
      home: serverData.home_roster,
      away: serverData.away_roster,
    };
  }

  const applyServerToPresented = useCallback((payload: MatchScorebookPayload) => {
    const normalized = normalizeLiveScorebookPayload(payload);
    setServerData(normalized);
    if (!flashActiveRef.current) {
      setPresentedData(normalized);
      pendingApplyRef.current = false;
    } else {
      pendingApplyRef.current = true;
    }
  }, []);

  const load = useCallback(async () => {
    if (!Number.isFinite(matchId)) {
      setErrorMessage('Neispravan ID utakmice');
      setLoading(false);
      return;
    }

    if (loadInFlightRef.current) {
      loadQueuedRef.current = true;
      await loadInFlightRef.current;
      return;
    }

    const run = async () => {
      do {
        loadQueuedRef.current = false;
        const { data: rpcData, error } = await supabase.rpc('get_zapisnicar_match_detail', {
          p_match_id: matchId,
        });
        if (error) {
          setErrorMessage(error.message);
          setLoading(false);
          return;
        }
        setErrorMessage('');
        applyServerToPresented(rpcData as MatchScorebookPayload);
        setLoading(false);
        await onAfterReloadRef.current?.();
      } while (loadQueuedRef.current);
    };

    const p = run().finally(() => {
      loadInFlightRef.current = null;
    });
    loadInFlightRef.current = p;
    await p;
  }, [applyServerToPresented, matchId]);

  const cancelFlash = useCallback(() => {
    flashActiveRef.current = false;
    setFlash(null);
  }, []);

  const reloadImmediate = useCallback(async () => {
    cancelFlash();
    pendingApplyRef.current = false;
    blockScoreOnlyReloadRef.current = false;
    flashActiveRef.current = false;
    loadQueuedRef.current = true;
    await load();
  }, [cancelFlash, load]);

  const reloadImmediateRef = useRef(reloadImmediate);
  reloadImmediateRef.current = reloadImmediate;

  const loadRef = useRef(load);
  loadRef.current = load;

  const beginFlash = useCallback((payload: MatchScoreFlashPayload) => {
    flashActiveRef.current = true;
    setFlash(payload);
  }, []);

  const beginFlashRef = useRef(beginFlash);
  beginFlashRef.current = beginFlash;

  const handleScoreInsertFromRow = useCallback(
    (row: MatchEventInsertRow) => {
      if (!isScoreFlashEventType(row.event_type)) return;

      const sup = suppressedInsertRef.current;
      if (
        sup &&
        sup.userId === row.user_id &&
        sup.eventType === row.event_type &&
        Date.now() - sup.at < 5000
      ) {
        suppressedInsertRef.current = null;
        return;
      }

      const { home, away } = rosterRef.current;
      beginFlashRef.current(
        buildScoreFlashPayload(
          home,
          away,
          row.user_id,
          row.event_type,
          `rt-${row.id}-${row.user_id}-${row.event_type}`,
        ),
      );
    },
    [],
  );

  const handleLocalScoreRecorded = useCallback(
    (userId: string, eventType: MatchScoreFlashEventType) => {
      suppressedInsertRef.current = { userId, eventType, at: Date.now() };
      const { home, away } = rosterRef.current;
      beginFlashRef.current(buildScoreFlashPayload(home, away, userId, eventType));
    },
    [],
  );

  const handleFlashComplete = useCallback(async () => {
    setFlash(null);
    blockScoreOnlyReloadRef.current = true;
    flashActiveRef.current = false;
    pendingApplyRef.current = false;
    loadQueuedRef.current = true;
    try {
      await load();
    } finally {
      blockScoreOnlyReloadRef.current = false;
    }
  }, [load]);

  const handleFlashCompleteRef = useRef(handleFlashComplete);
  handleFlashCompleteRef.current = handleFlashComplete;

  useEffect(() => {
    setLoading(true);
    cancelFlash();
    void load();
  }, [cancelFlash, load]);

  useImperativeHandle(
    ref,
    () => ({
      refresh: load,
    }),
    [load],
  );

  const liveSyncEnabled =
    Boolean(serverData) &&
    Number.isFinite(matchId) &&
    !isFinishedStatus(serverData?.match.status);

  const handleMatchUpdate = useCallback(
    (newRow: Record<string, unknown>, oldRow: Record<string, unknown>) => {
      const lifecycleChanged =
        newRow.status !== oldRow.status ||
        newRow.started_at !== oldRow.started_at ||
        newRow.ended_at !== oldRow.ended_at;

      if (lifecycleChanged) {
        void reloadImmediateRef.current();
        return;
      }

      if (flashActiveRef.current || blockScoreOnlyReloadRef.current) return;

      loadQueuedRef.current = true;
      void loadRef.current();
    },
    [],
  );

  useMatchScorebookRealtime(
    matchId,
    {
      onScoreInsert: handleScoreInsertFromRow,
      onScoreDelete: () => {
        void reloadImmediateRef.current();
      },
      onMatchUpdate: handleMatchUpdate,
    },
    { enabled: liveSyncEnabled },
  );

  const statusRef = useRef(serverData?.match.status);
  statusRef.current = serverData?.match.status;
  const flashActiveForPollRef = useRef(flashActiveRef);
  flashActiveForPollRef.current = flashActiveRef;

  useEffect(() => {
    if (!serverData || isFinishedStatus(serverData.match.status)) return;

    const st = String(serverData.match.status ?? '').toLowerCase();
    const scorer = Boolean(serverData.can_score);
    let intervalMs = 60000;
    if (st === 'live') intervalMs = scorer ? 30000 : 22000;
    else if (st === 'scheduled') intervalMs = 60000;

    const t = setInterval(() => {
      if (isFinishedStatus(statusRef.current)) return;
      if (flashActiveForPollRef.current.current) return;
      void loadRef.current();
    }, intervalMs);

    return () => clearInterval(t);
  }, [serverData?.match.status, serverData?.can_score, serverData]);

  const finished = presentedData ? isFinishedStatus(presentedData.match.status) : false;

  return (
    <View style={styles.screen}>
      <View style={styles.topPad}>
        {topAccessory ? <View style={styles.accessoryWrap}>{topAccessory}</View> : null}

        {loading ? <ActivityIndicator /> : null}
        {errorMessage ? (
          <ThemedView style={styles.errorCard}>
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </ThemedView>
        ) : null}
      </View>

      {presentedData && !loading ? (
        <View style={styles.bodyFill}>
          {finished ? (
            <MatchFinishedBoxScoreView
              data={presentedData}
              variant="final"
              belowHero={boxScoreBelowHero}
            />
          ) : presentedData.can_score ? (
            <MatchScorebookLiveView
              matchId={matchId}
              data={presentedData}
              onScoreRecorded={handleLocalScoreRecorded}
              onUndoComplete={reloadImmediate}
              onActionError={setErrorMessage}
            />
          ) : (
            <MatchFinishedBoxScoreView
              data={presentedData}
              variant={readOnlyBoxVariant(presentedData.match.status)}
            />
          )}

          {flash ? (
            <MatchScoreEventFlash
              key={flash.key}
              label={flash.label}
              onComplete={() => {
                void handleFlashCompleteRef.current();
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bodyFill: { flex: 1 },
  accessoryWrap: { marginBottom: 4, gap: 6 },
  screen: { flex: 1 },
  topPad: { paddingHorizontal: 8, paddingTop: 8 },
  errorCard: { borderWidth: 1, borderColor: '#c53939', borderRadius: 6, padding: 8, marginBottom: 4 },
  errorText: { color: '#c53939', fontSize: 13 },
});
