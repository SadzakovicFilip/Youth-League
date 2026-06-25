import type { MatchDayCalendarMarker } from '@/components/shared/match-timetable-calendar';
import {
  isMatchDbFinished,
  resolveMatchDisplayStatusKey,
  type MatchForDisplayStatus,
} from '@/lib/match-display-status';

export const CALENDAR_LIVE_BLUE = '#2563eb';

/** Boje za zakazana / isčekivanje / nema uslova (ne mešati sa zelena/žuta/crvena/plava uživo). */
export type MatchCalendarStatusColors = {
  zakazana: string;
  iscekivanje: string;
  nemaUslova: string;
};

export function getMatchCalendarStatusColors(
  scheme: 'light' | 'dark',
): MatchCalendarStatusColors {
  if (scheme === 'dark') {
    return {
      zakazana: '#94A3B8',
      iscekivanje: '#2DD4BF',
      nemaUslova: '#C084FC',
    };
  }
  return {
    zakazana: '#64748B',
    iscekivanje: '#0D9488',
    nemaUslova: '#9333EA',
  };
}

export type MatchCalendarMarkerInput = MatchForDisplayStatus & {
  objection_marker?: 'none' | 'pending' | 'resolved' | string | null;
};

const MARKER_PRIORITY: Record<MatchDayCalendarMarker, number> = {
  objection_pending: 100,
  uzivo: 90,
  iscekivanje: 80,
  nema_uslova: 70,
  star: 70,
  dot: 60,
  neodigrana: 50,
  played_resolved: 40,
  played_ok: 30,
};

function isMatchCalendarRow(m: MatchCalendarMarkerInput): boolean {
  return (
    m.status != null ||
    m.display_status != null ||
    (m.objection_marker != null && m.objection_marker !== 'none')
  );
}

/** Marker za jednu utakmicu na osnovu prikaznog statusa. */
export function matchToCalendarMarker(m: MatchCalendarMarkerInput): MatchDayCalendarMarker {
  const phase = String((m as { phase?: string | null }).phase ?? '').toLowerCase();
  if (phase === 'played') {
    return 'played_ok';
  }

  if (!isMatchCalendarRow(m)) {
    return 'dot';
  }
  if (
    m.objection_marker === 'pending' &&
    (isMatchDbFinished(m.status) || resolveMatchDisplayStatusKey(m) === 'zavrsena')
  ) {
    return 'objection_pending';
  }

  const key = resolveMatchDisplayStatusKey(m);
  switch (key) {
    case 'uzivo':
      return 'uzivo';
    case 'iscekivanje':
      return 'iscekivanje';
    case 'nema_uslova':
      return 'nema_uslova';
    case 'neodigrana':
      return 'neodigrana';
    case 'zavrsena':
      return m.objection_marker === 'resolved' ? 'played_resolved' : 'played_ok';
    case 'zakazana':
    default:
      return 'dot';
  }
}

/** Najvažniji marker za dan (više utakmica istog dana). */
export function resolveDayMarkerFromMatches(
  dayMatches: MatchCalendarMarkerInput[],
): MatchDayCalendarMarker | null {
  if (dayMatches.length === 0) return null;

  let best: MatchDayCalendarMarker | null = null;
  let bestPri = -1;

  for (const m of dayMatches) {
    const marker = matchToCalendarMarker(m);
    const pri = MARKER_PRIORITY[marker] ?? 0;
    if (pri > bestPri) {
      bestPri = pri;
      best = marker;
    }
  }

  return best;
}
