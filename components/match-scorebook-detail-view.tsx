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
  type MatchEventDeleteRow,
  type MatchEventInsertRow,
} from '@/hooks/use-match-scorebook-realtime';
import {
  buildGenericUndoFlashPayload,
  buildScoreFlashPayload,
  buildUndoFlashPayload,
  buildWhistleFlashPayload,
  matchLifecycleWhistlePhase,
  undoFlashKey,
  whistleFlashKey,
  type MatchScoreFlashEventType,
  type MatchScoreFlashPayload,
  type MatchWhistlePhase,
} from '@/lib/match-score-flash-label';
import { playMatchAppSoundForFlash } from '@/lib/app-feedback';
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
  const suppressedDeleteRef = useRef<{
    deletedId?: number;
    userId?: string;
    eventType?: string;
    at: number;
  } | null>(null);
  const localUndoPendingRef = useRef(false);
  const lastUndoFlashKeyRef = useRef<string | null>(null);
  const lastWhistleFlashKeyRef = useRef<string | null>(null);
  const undoFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<MatchScoreFlashPayload | null>(null);
  flashRef.current = flash;
  const presentedDataRef = useRef(presentedData);
  presentedDataRef.current = presentedData;
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

  const beginFlashRef = useRef<(payload: MatchScoreFlashPayload) => void>(() => {});

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
        const incoming = normalizeLiveScorebookPayload(rpcData as MatchScorebookPayload);
        const presented = presentedDataRef.current;
        if (
          presented?.is_zapisnicar &&
          !flashActiveRef.current &&
          presented.match.status !== incoming.match.status
        ) {
          const phase = matchLifecycleWhistlePhase(presented.match.status, incoming.match.status);
          if (phase) {
            const key = whistleFlashKey(matchId, phase);
            if (lastWhistleFlashKeyRef.current !== key) {
              beginFlashRef.current(buildWhistleFlashPayload(phase, matchId, key));
              setServerData(incoming);
              pendingApplyRef.current = true;
              setLoading(false);
              await onAfterReloadRef.current?.();
              continue;
            }
          }
        }
        applyServerToPresented(incoming);
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
    if (payload.variant === 'undo') {
      if (flashActiveRef.current && flashRef.current?.key === payload.key) return;
      if (lastUndoFlashKeyRef.current === payload.key) return;
      lastUndoFlashKeyRef.current = payload.key;
    }
    if (payload.variant === 'whistle') {
      if (flashActiveRef.current && flashRef.current?.key === payload.key) return;
      if (lastWhistleFlashKeyRef.current === payload.key) return;
      lastWhistleFlashKeyRef.current = payload.key;
    }
    playMatchAppSoundForFlash(payload, matchId);
    flashActiveRef.current = true;
    setFlash(payload);
  }, [matchId]);

  beginFlashRef.current = beginFlash;

  const tryBeginWhistleTransition = useCallback(
    (newStatus: string | null | undefined): boolean => {
      const presented = presentedDataRef.current;
      if (!presented?.is_zapisnicar || flashActiveRef.current) return false;
      const phase: MatchWhistlePhase | null = matchLifecycleWhistlePhase(
        presented.match.status,
        newStatus,
      );
      if (!phase) return false;
      const key = whistleFlashKey(matchId, phase);
      if (lastWhistleFlashKeyRef.current === key) return true;
      beginFlashRef.current(buildWhistleFlashPayload(phase, matchId, key));
      return true;
    },
    [matchId],
  );

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

  const handleUndoStarted = useCallback(() => {
    localUndoPendingRef.current = true;
    suppressedDeleteRef.current = { at: Date.now() };
  }, []);

  const handleUndoAborted = useCallback(() => {
    localUndoPendingRef.current = false;
    suppressedDeleteRef.current = null;
  }, []);

  const handleLocalUndoComplete = useCallback(
    (result: { userId: string; eventType: MatchScoreFlashEventType; deletedId?: number }) => {
      localUndoPendingRef.current = false;
      suppressedDeleteRef.current = {
        deletedId: result.deletedId,
        userId: result.userId,
        eventType: result.eventType,
        at: Date.now(),
      };
      const { home, away } = rosterRef.current;
      const key = undoFlashKey(result.deletedId, result.userId, result.eventType);
      beginFlashRef.current(
        buildUndoFlashPayload(home, away, result.userId, result.eventType, key),
      );
    },
    [],
  );

  const handleScoreDeleteFromRow = useCallback((row: MatchEventDeleteRow) => {
    if (localUndoPendingRef.current) return;
    if (undoFallbackTimerRef.current) {
      clearTimeout(undoFallbackTimerRef.current);
      undoFallbackTimerRef.current = null;
    }
    if (flashActiveRef.current && flashRef.current?.variant === 'undo') return;

    const sup = suppressedDeleteRef.current;
    const flashKey = row.id != null ? undoFlashKey(row.id) : null;
    if (flashKey && lastUndoFlashKeyRef.current === flashKey) return;

    if (sup && Date.now() - sup.at < 8000) {
      const sameEvent =
        (row.id != null && sup.deletedId != null && row.id === sup.deletedId) ||
        (row.user_id != null &&
          row.event_type != null &&
          row.user_id === sup.userId &&
          row.event_type === sup.eventType);
      if (sameEvent) {
        suppressedDeleteRef.current = null;
        return;
      }
    }

    const { home, away } = rosterRef.current;
    const eventType = row.event_type ?? '';
    if (row.user_id && isScoreFlashEventType(eventType)) {
      beginFlashRef.current(
        buildUndoFlashPayload(
          home,
          away,
          row.user_id,
          eventType,
          flashKey ?? undoFlashKey(undefined, row.user_id, eventType),
        ),
      );
      return;
    }

    beginFlashRef.current(
      buildGenericUndoFlashPayload(flashKey ?? `undo-rt-${Date.now()}`),
    );
  }, []);

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
      setTimeout(() => {
        lastUndoFlashKeyRef.current = null;
        lastWhistleFlashKeyRef.current = null;
      }, 400);
    }
  }, [load]);

  const handleFlashCompleteRef = useRef(handleFlashComplete);
  handleFlashCompleteRef.current = handleFlashComplete;

  useEffect(() => {
    setLoading(true);
    cancelFlash();
    void load();
    return () => {
      if (undoFallbackTimerRef.current) clearTimeout(undoFallbackTimerRef.current);
    };
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

  const tryBeginWhistleTransitionRef = useRef(tryBeginWhistleTransition);
  tryBeginWhistleTransitionRef.current = tryBeginWhistleTransition;

  const handleMatchUpdate = useCallback(
    (newRow: Record<string, unknown>, oldRow: Record<string, unknown>) => {
      const lifecycleChanged =
        newRow.status !== oldRow.status ||
        newRow.started_at !== oldRow.started_at ||
        newRow.ended_at !== oldRow.ended_at;

      if (lifecycleChanged) {
        const newStatus = String(newRow.status ?? '');
        if (tryBeginWhistleTransitionRef.current(newStatus)) {
          return;
        }
        void reloadImmediateRef.current();
        return;
      }

      const newHome = Number(newRow.home_score ?? 0);
      const newAway = Number(newRow.away_score ?? 0);
      const newTotal = newHome + newAway;

      const presented = presentedDataRef.current?.match;
      const prevHome = Number(presented?.home_score ?? oldRow.home_score ?? 0);
      const prevAway = Number(presented?.away_score ?? oldRow.away_score ?? 0);
      const prevTotal = prevHome + prevAway;

      const scoreDecreased =
        newTotal < prevTotal && !flashActiveRef.current && !localUndoPendingRef.current;

      if (scoreDecreased) {
        if (undoFallbackTimerRef.current) clearTimeout(undoFallbackTimerRef.current);
        undoFallbackTimerRef.current = setTimeout(() => {
          undoFallbackTimerRef.current = null;
          if (flashActiveRef.current || localUndoPendingRef.current) return;
          beginFlashRef.current(
            buildGenericUndoFlashPayload(`undo-fallback-${prevTotal}-${newTotal}`),
          );
        }, 200);
      }

      if (flashActiveRef.current || blockScoreOnlyReloadRef.current || scoreDecreased) return;

      loadQueuedRef.current = true;
      void loadRef.current();
    },
    [],
  );

  useMatchScorebookRealtime(
    matchId,
    {
      onScoreInsert: handleScoreInsertFromRow,
      onScoreDelete: handleScoreDeleteFromRow,
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
              onUndoStarted={handleUndoStarted}
              onUndoAborted={handleUndoAborted}
              onUndoComplete={handleLocalUndoComplete}
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
              animationKey={flash.key}
              variant={flash.variant}
              label={flash.label}
              undoDetail={flash.undoDetail}
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
