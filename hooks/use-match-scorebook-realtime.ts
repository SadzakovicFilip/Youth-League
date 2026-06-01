/**
 * Postgres changes → flash animacija (INSERT) ili odmah reload (DELETE / status UPDATE).
 * Supabase Dashboard: Database → Replication → uključiti za `match_events`, `matches`.
 */
import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';

export type MatchEventInsertRow = {
  id: number;
  match_id: number;
  user_id: string;
  event_type: string;
  points: number;
};

export type MatchScorebookRealtimeHandlers = {
  /** Novi kos / faul — prikaži animaciju, reload tek posle nje. */
  onScoreInsert: (row: MatchEventInsertRow) => void;
  /** Undo — odmah osveži (bez animacije). */
  onScoreDelete: () => void;
  /** Početak/kraj meča; promena samo poena ide kroz animaciju. */
  onMatchUpdate: (newRow: Record<string, unknown>, oldRow: Record<string, unknown>) => void;
};

export function useMatchScorebookRealtime(
  matchId: number,
  handlers: MatchScorebookRealtimeHandlers,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled !== false && Number.isFinite(matchId);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const name = `match-scorebook-realtime:${matchId}`;
    const channel = supabase.channel(name);

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new as MatchEventInsertRow | undefined;
          if (!row?.user_id || !row.event_type) return;
          handlersRef.current.onScoreInsert(row);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'match_events',
        },
        (payload) => {
          const old = payload.old as { match_id?: number } | undefined;
          if (old?.match_id != null && Number(old.match_id) !== matchId) return;
          handlersRef.current.onScoreDelete();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          handlersRef.current.onMatchUpdate(
            (payload.new ?? {}) as Record<string, unknown>,
            (payload.old ?? {}) as Record<string, unknown>,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, matchId]);
}
