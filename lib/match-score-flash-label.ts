import type { MatchScorebookRosterPlayer } from '@/components/match-scorebook-types';

export type MatchScoreFlashEventType = 'free_throw' | 'field' | 'three' | 'foul';

export type MatchWhistlePhase = 'start' | 'end';

export type MatchScoreFlashVariant = 'score' | 'undo' | 'whistle';

export type MatchScoreFlashPayload = {
  userId: string;
  eventType: MatchScoreFlashEventType;
  variant: MatchScoreFlashVariant;
  /** Score: pun tekst. Undo: velika strelica (↶). Whistle: ne koristi se (ikona). */
  label: string;
  /** Undo / whistle: manji tekst ispod glavnog simbola. */
  undoDetail?: string;
  whistlePhase?: MatchWhistlePhase;
  /** Jedinstven ključ za remount animacije. */
  key: string;
};

export function matchLifecycleWhistlePhase(
  oldStatus: string | null | undefined,
  newStatus: string | null | undefined,
): MatchWhistlePhase | null {
  const old = String(oldStatus ?? '').toLowerCase();
  const next = String(newStatus ?? '').toLowerCase();
  if (old === 'scheduled' && next === 'live') return 'start';
  if (old === 'live' && next === 'finished') return 'end';
  return null;
}

export function eventTypePointsLabel(eventType: string): string {
  switch (eventType) {
    case 'free_throw':
      return '+1';
    case 'field':
      return '+2';
    case 'three':
      return '+3';
    case 'foul':
      return 'FOUL';
    default:
      return '';
  }
}

function shortPlayerName(
  p: Pick<
    MatchScorebookRosterPlayer,
    'display_name' | 'first_name' | 'last_name' | 'username'
  > | undefined,
): string {
  if (!p) return '?';
  const raw =
    p.display_name?.trim() ||
    p.last_name?.trim() ||
    p.first_name?.trim() ||
    p.username?.trim() ||
    '?';
  const token = raw.split(/\s+/)[0] ?? raw;
  return token.toUpperCase().slice(0, 12);
}

export function findRosterPlayer(
  home: MatchScorebookRosterPlayer[],
  away: MatchScorebookRosterPlayer[],
  userId: string,
): MatchScorebookRosterPlayer | undefined {
  return home.find((p) => p.user_id === userId) ?? away.find((p) => p.user_id === userId);
}

export function buildScoreFlashLabel(
  player: MatchScorebookRosterPlayer | undefined,
  eventType: string,
): string {
  const jersey = player?.jersey_number ?? '?';
  const name = shortPlayerName(player);
  const pts = eventTypePointsLabel(eventType);
  return `#${jersey} ${name} : ${pts}`;
}

export function buildScoreFlashPayload(
  home: MatchScorebookRosterPlayer[],
  away: MatchScorebookRosterPlayer[],
  userId: string,
  eventType: MatchScoreFlashEventType,
  key?: string,
): MatchScoreFlashPayload {
  const player = findRosterPlayer(home, away, userId);
  return {
    userId,
    eventType,
    variant: 'score',
    label: buildScoreFlashLabel(player, eventType),
    key: key ?? `score-${Date.now()}-${userId}-${eventType}`,
  };
}

export function undoFlashKey(deletedId?: number, userId?: string, eventType?: string): string {
  if (deletedId != null) return `undo-${deletedId}`;
  return `undo-${userId ?? 'x'}-${eventType ?? 'x'}-${Date.now()}`;
}

export function buildUndoFlashPayload(
  home: MatchScorebookRosterPlayer[],
  away: MatchScorebookRosterPlayer[],
  userId: string,
  eventType: MatchScoreFlashEventType,
  key?: string,
): MatchScoreFlashPayload {
  const player = findRosterPlayer(home, away, userId);
  const jersey = player?.jersey_number ?? '?';
  const name = shortPlayerName(player);
  const pts = eventTypePointsLabel(eventType);
  return {
    userId,
    eventType,
    variant: 'undo',
    label: '↶',
    undoDetail: `#${jersey} ${name}  ${pts}`,
    key: key ?? undoFlashKey(undefined, userId, eventType),
  };
}

export function buildGenericUndoFlashPayload(key?: string): MatchScoreFlashPayload {
  return {
    userId: '',
    eventType: 'free_throw',
    variant: 'undo',
    label: '↶',
    undoDetail: 'Poništen upis',
    key: key ?? `undo-generic-${Date.now()}`,
  };
}

export function buildWhistleFlashPayload(
  phase: MatchWhistlePhase,
  matchId: number,
  key?: string,
): MatchScoreFlashPayload {
  return {
    userId: '',
    eventType: 'free_throw',
    variant: 'whistle',
    label: 'whistle',
    undoDetail: phase === 'start' ? 'POČETAK UTAKMICE' : 'KRAJ UTAKMICE',
    whistlePhase: phase,
    key: key ?? `whistle-${matchId}-${phase}-${Date.now()}`,
  };
}

export function whistleFlashKey(matchId: number, phase: MatchWhistlePhase): string {
  return `whistle-${matchId}-${phase}`;
}
